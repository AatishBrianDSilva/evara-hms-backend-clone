import { APIGatewayProxyHandler } from "aws-lambda";
import mongoose from "mongoose";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { PharmacyStock } from "@evara-backend/core/models/pharmacyDashboard/PharmacyStock";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb();

    if (event.body == null) {
      throw new ErrorMessage(400, "Data is required");
    }

    const {
      pharmacyStockId,
      sourceLocationId,
      destinationLocationId,
      quantity,
    } = JSON.parse(event.body);

    // Begin a session for a transaction
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const pharmacyStock = await PharmacyStock.findById(
        pharmacyStockId
      ).session(session);

      if (!pharmacyStock) {
        throw new Error("Pharmacy Stock not found");
      }

      // Find and update source and destination locations within the pharmacyStock
      const sourceLocation = pharmacyStock.locations.find(
        (location) => location.location.toString() === sourceLocationId
      );
      const destinationLocation = pharmacyStock.locations.find(
        (location) => location.location.toString() === destinationLocationId
      );

      if (!sourceLocation || !destinationLocation) {
        throw new Error("One or both locations not found");
      }

      // Update quantities
      if (sourceLocation.quantity < quantity) {
        throw new Error("Insufficient stock in source location");
      }
      sourceLocation.quantity -= quantity;
      destinationLocation.quantity += quantity;

      await pharmacyStock.save({ session });

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      return successResponse(
        "Stock quantities updated successfully",
        pharmacyStock
      );
    } catch (error) {
      // Abort the transaction in case of error
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error(error);
    return errorResponse(error);
  }
};
