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
import { TaxRate } from '@evara-backend/core/src/models/pharmacyDashboard/TaxRate';
import { EPatientBillingServiceType } from '@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling';
import {
  PatientBillingEstimation,
  EPatientBillingEstimationStatus,
} from '@evara-backend/core/src/models/patientDashboard/Billings/PatientBillingEstimation';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';

// Helper function to create estimation directly (fallback when SNS fails)
const createEstimationDirectly = async (
  patientCode: string,
  doctorId: any,
  masterServiceId: any,
  serviceId: any,
  serviceType: EPatientBillingServiceType,
  serviceName: string,
  serviceCost: number,
  quantity: number,
  clinicId: string,
  branchId: string,
  itemId?: any,
) => {
  let estimatedPrice: number = 0;
  let estimatedTax: number = 0;
  let estimatedUnitPrice: number = 0;
  let total: number = 0;
  let taxRate: number = 0;
  let cost: number = 0;

  if (serviceType === EPatientBillingServiceType.Pharmacy) {
    const service: any = await PharmacyStock.findById(masterServiceId).populate(
      [
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
            {
              path: 'taxRate',
              model: TaxRate.modelName,
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
      ],
    );

    if (!service) {
      throw new ErrorMessage(404, 'Service not found');
    }

    const sellPrice = serviceCost || service.sellPrice;
    const tax = service.item?.taxRate?.taxRate || 0;
    const packSize = service.item.packSize || 1;

    const mrpPerUnit = sellPrice / packSize;

    estimatedUnitPrice = parseFloat((mrpPerUnit / (1 + tax / 100)).toFixed(2));
    estimatedPrice = estimatedUnitPrice * quantity;

    total = mrpPerUnit * quantity;
    estimatedTax = parseFloat((total - estimatedPrice).toFixed(2));

    taxRate = tax;
    cost = total;
  }

  const newEstimation = new PatientBillingEstimation({
    clinicId,
    branchId,
    patientCode,
    doctorId,
    masterServiceId,
    serviceId,
    serviceType,
    serviceName,
    quantity,
    estimatedTax:
      serviceType === EPatientBillingServiceType.Pharmacy ? estimatedTax : null,
    taxRate:
      serviceType === EPatientBillingServiceType.Pharmacy ? taxRate : null,
    cost: cost,
    estimatedUnitPrice: estimatedUnitPrice,
    estimatedPrice: estimatedPrice,
    estimatedTotal: total,
    status: EPatientBillingEstimationStatus.Active,
  });

  await newEstimation.save();

  return newEstimation;
};

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

    // Store created pharmacies for SNS publish after transaction commit
    const createdPharmacies: Array<{
      newPharmacy: any;
      pharmacyStock: any;
      serviceName: string;
      sellPrice: number;
      itemId: any; // ObjectId from mongoose
    }> = [];

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

      await stock.save({ session });

      const sellPrice = batch?.sellPrice;

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

        // Store for SNS publish AFTER transaction commit
        createdPharmacies.push({
          newPharmacy,
          pharmacyStock,
          serviceName,
          sellPrice,
          itemId,
        });
      } else {
        console.error('Master Pharmacy not found');
      }
    }

    // Commit transaction FIRST - ensure PatientPharmacy exists in database
    await session.commitTransaction();
    session.endSession();

    // NOW publish SNS AFTER transaction is committed ✅
    // This ensures PatientPharmacy exists before estimation is created
    // If SNS publish fails (network issues, etc.), we retry automatically with exponential backoff
    // If all retries fail, we create estimation directly as fallback
    const snsErrors: Array<{
      pharmacyId: string;
      error: any;
      fallbackError?: any;
    }> = [];
    const maxRetries = 3; // Number of retry attempts for SNS publish

    for (const {
      newPharmacy,
      pharmacyStock,
      serviceName,
      sellPrice,
      itemId,
    } of createdPharmacies) {
      // Retry SNS publish with exponential backoff
      let lastError: any = null;
      let published = false;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Retry logging for failed attempts
          if (attempt > 1) {
            console.log(
              `Retrying SNS publish (attempt ${attempt}/${maxRetries}) for PatientPharmacy: ${newPharmacy._id}`,
            );
          }

          // Publish to SNS with retry logic
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
            itemId,
          );

          published = true;
          break; // Success, exit retry loop
        } catch (snsError) {
          lastError = snsError;
          console.warn(
            `SNS publish attempt ${attempt}/${maxRetries} failed for PatientPharmacy ${newPharmacy._id}`,
          );

          // If not the last attempt, wait before retrying (exponential backoff)
          if (attempt < maxRetries) {
            const delayMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }
      }

      // If all retries failed, create estimation directly as fallback
      if (!published) {
        console.warn(
          `SNS publish failed after ${maxRetries} attempts for PatientPharmacy ${newPharmacy._id}. Creating estimation directly (fallback).`,
        );

        try {
          await createEstimationDirectly(
            newPharmacy.patient,
            newPharmacy.doctor,
            pharmacyStock._id,
            newPharmacy._id,
            EPatientBillingServiceType.Pharmacy,
            serviceName,
            sellPrice,
            newPharmacy.totalQuantity,
            auth.clinicId,
            auth.branchId,
            itemId,
          );
        } catch (fallbackError) {
          // If fallback also fails, log error but don't fail the operation
          console.error(
            `Failed to create estimation directly (fallback) for PatientPharmacy ${newPharmacy._id}`,
            fallbackError,
          );
          snsErrors.push({
            pharmacyId: newPharmacy._id.toString(),
            error:
              lastError instanceof Error
                ? lastError.message
                : String(lastError),
            fallbackError:
              fallbackError instanceof Error
                ? fallbackError.message
                : String(fallbackError),
          });
        }
      }
    }

    // Log summary if there were any errors after all retries and fallback
    if (snsErrors.length > 0) {
      console.error(
        `PatientPharmacy created successfully, but ${snsErrors.length} estimation(s) failed to be created after SNS retries and fallback. Manual intervention required.`,
        snsErrors,
      );
    }

    return successResponse('Patient pharmacy data successfully added.');
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error adding patient pharmacy data:', error);
    return errorResponse(error);
  }
};
