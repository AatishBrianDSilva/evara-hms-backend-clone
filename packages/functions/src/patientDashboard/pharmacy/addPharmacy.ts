import { APIGatewayProxyHandler } from 'aws-lambda';
import mongoose from 'mongoose';
type ObjectId = mongoose.Types.ObjectId;

import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import {
  PatientPharmacy,
  IPatientPharmacyModel,
} from '@evara-backend/core/src/models/patientDashboard/PatientPharmacy';
import { PharmacyStock } from '@evara-backend/core/src/models/pharmacyDashboard/PharmacyStock';
import { publishBillingServiceToSNS } from '@evara-backend/core/src/lib/utils/publishBillingServiceToSNS';
import { DrugItem } from '@evara-backend/core/src/models/pharmacyDashboard/DrugItem';
import { DrugCategory } from '@evara-backend/core/src/models/pharmacyDashboard/DrugCategory';
import { DrugType } from '@evara-backend/core/src/models/pharmacyDashboard/DrugType';
import { DrugLocation } from '@evara-backend/core/src/models/pharmacyDashboard/DrugLocation';
import { DrugVendor } from '@evara-backend/core/src/models/pharmacyDashboard/DrugVendor';
import { EPatientBillingServiceType } from '@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const auth = extractAuthorizerDetails(event);

  const conn = await connectMongoDb();
  const session = await conn.startSession();
  session.startTransaction();

  try {
    if (!event.body) {
      throw new ErrorMessage(400, 'Data is required');
    }

    const data = JSON.parse(event.body);

    const location = data.location;

    for (const item of data.items) {
      // Validate and deduct stock
      const stock = await PharmacyStock.findById(item.stock).session(session);
      if (!stock) {
        throw new ErrorMessage(404, 'Pharmacy Stock not found');
      }

      // Capture the ID of the associated item
      const itemId = stock.item;

      if (stock.totalQuantity < item.quantity) {
        throw new ErrorMessage(400, 'Insufficient stock available');
      }

      // Deduct quantity from the relevant location and batch in the stock
      const batch = stock.batches.find(b => b.batchNo === item.batchNumber);
      if (!batch) {
        throw new ErrorMessage(400, 'Batch number not found in stock.');
      }

      const locationQuantity = batch.locations.find(
        l => l.location.toString() === location.toString(),
      );
      if (!locationQuantity) {
        throw new ErrorMessage(400, 'Location not found');
      }

      if (locationQuantity.quantity < item.quantity) {
        throw new ErrorMessage(400, 'Insufficient stock at location');
      }

      // Deduct quantity for the selected location
      locationQuantity.quantity -= item.quantity;

      console.log("Batch", batch)
      console.log("Stock", stock)

      await stock.save({ session });

      const sellPrice = batch.sellPrice;

      console.log("Sell price", sellPrice)

      // Create and save PatientPharmacy entry
      const newPatientPharmacy = new PatientPharmacy({
        branchId: auth.branchId,
        clinicId: auth.clinicId,
        patient: data.patient,
        item: {
          stock: item.stock,
          details: [
            {
              location: location, // Use the location from the main data object
              quantity: item.quantity,
              batchNumber: item.batchNumber,
              packSize: batch.packSize,
              mrp: sellPrice,
              vendor: batch.vendor,
              expiryDate: batch.expiryDate,
              itemId: itemId,
            },
          ],
        },
        doctor: data.doctor,
        date: data.date,
        allocatedBy: 'User 1',
      });

      console.log("New pharmacy item", newPatientPharmacy)

      const newPharmacy = await newPatientPharmacy.save({ session });

      const pharmacyStock: any = await PharmacyStock.findById(
        newPharmacy.item.stock,
      ).populate([
        {
          path: 'item',
          model: DrugItem.modelName,
          populate: [
            {
              path: 'category',
              model: DrugCategory.modelName,
            },
            {
              path: 'type',
              model: DrugType.modelName,
            },
          ],
        },
        {
          path: 'batches.locations.location',
          model: DrugLocation.modelName,
        },
        {
          path: 'batches.vendor',
          model: DrugVendor.modelName,
        },
        {
          path: 'batches.vendor.location',
          model: DrugLocation.modelName,
        },
      ]);

      if (pharmacyStock) {
        const serviceName = pharmacyStock.item?.name;

         // Log the data being sent to SNS
  console.log('Data to be published to SNS:', {
    patient: newPharmacy.patient,
    doctor: newPharmacy.doctor,
    stockId: pharmacyStock._id,
    pharmacyId: newPharmacy._id,
    serviceType: EPatientBillingServiceType.Pharmacy,
    serviceName: serviceName,
    sellPrice: sellPrice,
    quantity: newPharmacy.totalQuantity,
    clinicId: auth.clinicId,
    branchId: auth.branchId,
    itemId: itemId,
  });

        // Publish to SNS
        await publishBillingServiceToSNS(
          newPharmacy.patient,
          newPharmacy.doctor,
          pharmacyStock._id,
          newPharmacy._id as any,
          EPatientBillingServiceType.Pharmacy,
          serviceName,
          sellPrice,
          newPharmacy.totalQuantity,
          auth.clinicId,
          auth.branchId,
          itemId, // Send the correct itemId
        );
      } else {
        console.error('Master Pharmacy not found');
      }
    }

    await session.commitTransaction();
    session.endSession();

    return successResponse('Patient pharmacy data successfully added.');
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error adding patient pharmacy data:', error);
    return errorResponse(error);
  }
};
