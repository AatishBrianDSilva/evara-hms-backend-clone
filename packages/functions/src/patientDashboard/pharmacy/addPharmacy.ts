import { APIGatewayProxyHandler } from "aws-lambda";
import mongoose from "mongoose";
type ObjectId = mongoose.Types.ObjectId;

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import {
  PatientPharmacy,
  IPatientPharmacyModel,
} from "@evara-backend/core/src/models/patientDashboard/PatientPharmacy";
import { PharmacyStock } from "@evara-backend/core/src/models/pharmacyDashboard/PharmacyStock";
import { publishBillingServiceToSNS } from "@evara-backend/core/src/lib/utils/publishBillingServiceToSNS";
import { DrugItem } from "@evara-backend/core/src/models/pharmacyDashboard/DrugItem";
import { DrugCategory } from "@evara-backend/core/src/models/pharmacyDashboard/DrugCategory";
import { DrugType } from "@evara-backend/core/src/models/pharmacyDashboard/DrugType";
import { DrugLocation } from "@evara-backend/core/src/models/pharmacyDashboard/DrugLocation";
import { DrugVendor } from "@evara-backend/core/src/models/pharmacyDashboard/DrugVendor";
import { EPatientBillingServiceType } from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling";

// AWS Lambda handler function to add data to PatientPharmacy model
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const conn = await connectMongoDb();
  const session = await conn.startSession();
  session.startTransaction();

  try {
    if (!event.body) {
      throw new ErrorMessage(400, "Data is required");
    }

    const data = JSON.parse(event.body);

    for (const item of data.items) {
      // Validate and deduct stock
      const stock = await PharmacyStock.findById(item.stock).session(session);
      if (!stock) {
        throw new ErrorMessage(404, "Pharmacy Stock not found");
      }

      let totalRequested = 0;
      item.details.forEach((detail: any) => {
        totalRequested += detail.quantity;
      });

      // console.log("Total requested:", totalRequested);

      if (stock.totalQuantity < totalRequested) {
        throw new ErrorMessage(400, "Insufficient stock available");
      }

      // Deduct quantities from the relevant locations in the stock
      item.details.forEach(async (detail: any) => {
        const batch = stock.batches.find((b) => b.batchNo === detail.batchNumber);
        if (!batch) {
          throw new Error("Batch number not found");
        }
        const locationQuantity = batch.locations.find(
          (l) => l.location.toString() === detail.location.toString()
        );
        if (!locationQuantity) {
          throw new Error("Location not found");
        }
        // console.log("Location quantity:", locationQuantity);
        if (locationQuantity.quantity < detail.quantity) {
          throw new Error("Insufficient stock at location");
        }
        locationQuantity.quantity -= detail.quantity;
      });

      await stock.save({ session });

      // Create and save PatientPharmacy entry
      const newPatientPharmacy = new PatientPharmacy({
        patient: data.patient,
        item,
        doctor: data.doctor,
        date: data.date,
        allocatedBy: "User 1",
      });
      const newPharmacy = await newPatientPharmacy.save({ session });

      const pharmacyStock: any = await PharmacyStock.findById(newPharmacy.item.stock).populate([
        {
          path: "item",
          model: DrugItem.modelName,
          populate: [
            {
              path: "category",
              model: DrugCategory.modelName,
            },
            {
              path: "type",
              model: DrugType.modelName,
            },
          ],
        },
        {
          path: "batches.locations.location",
          model: DrugLocation.modelName,
        },
        {
          path: "batches.vendor",
          model: DrugVendor.modelName,
        },
        {
          path: "batches.vendor.location",
          model: DrugLocation.modelName,
        },
      ]);

      if (pharmacyStock) {
        const serviceName = pharmacyStock.item?.name;

        // Publish to SNS
        await publishBillingServiceToSNS(
          newPharmacy.patient,
          newPharmacy.doctor,
          pharmacyStock._id,
          newPharmacy._id,
          EPatientBillingServiceType.Pharmacy,
          serviceName,
          // ToDO: Change to sell price once it's added to the model
          pharmacyStock.sellPrice,
          newPharmacy.totalQuantity
        );
      } else {
        console.error("Master Pharmacy not found");
      }
    }

    await session.commitTransaction();
    session.endSession();

    return successResponse("Patient pharmacy data successfully added.");
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error adding patient pharmacy data:", error);
    return errorResponse(error);
  }
};
