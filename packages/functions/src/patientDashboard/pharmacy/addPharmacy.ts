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

// AWS Lambda handler function to add data to PatientPharmacy model
export const main: APIGatewayProxyHandler = async (event, _context) => {
  const conn = await connectMongoDb();
  const session = await conn.startSession();
  session.startTransaction();

  try {
    if (!event.body) {
      throw new ErrorMessage(400, "Data is required");
    }

    const data: IPatientPharmacyModel = JSON.parse(event.body);

    for (const item of data.items) {
      // Validate and deduct stock
      const stock = await PharmacyStock.findById(item.stock).session(session);
      if (!stock) {
        throw new ErrorMessage(404, "Pharmacy Stock not found");
      }

      console.log("Stock:", JSON.stringify(stock, null, 2));

      let totalRequested = 0;
      item.details.forEach((detail) => {
        totalRequested += detail.quantity;
      });

      console.log("Total requested:", totalRequested);

      if (stock.totalQuantity < totalRequested) {
        throw new ErrorMessage(400, "Insufficient stock available");
      }

      // Deduct quantities from the relevant locations in the stock
      item.details.forEach(async (detail) => {
        const batch = stock.batches.find(
          (b) => b.batchNo === detail.batchNumber
        );
        if (!batch) {
          throw new Error("Batch number not found");
        }
        const locationQuantity = batch.locations.find(
          (l) => l.location.toString() === detail.location.toString()
        );
        if (!locationQuantity) {
          throw new Error("Location not found");
        }
        console.log("Location quantity:", locationQuantity);
        if (locationQuantity.quantity < detail.quantity) {
          throw new Error("Insufficient stock at location");
        }
        locationQuantity.quantity -= detail.quantity;
      });

      await stock.save({ session });
    }

    data.allocatedBy = "User 1";

    // Create and save PatientPharmacy entry
    const newPatientPharmacy = new PatientPharmacy(data);
    await newPatientPharmacy.save();

    await session.commitTransaction();
    session.endSession();

    return successResponse(
      "Patient pharmacy data successfully added.",
      newPatientPharmacy
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error adding patient pharmacy data:", error);
    return errorResponse(error);
  }
};
