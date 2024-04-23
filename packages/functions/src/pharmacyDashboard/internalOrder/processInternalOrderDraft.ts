import { APIGatewayProxyHandler } from "aws-lambda";
import mongoose from "mongoose";
type ObjectId = mongoose.Types.ObjectId; // Using type alias for clarity
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import {
  EInternalOrderStatus,
  InternalOrder,
} from "@evara-backend/core/models/pharmacyDashboard/InternalOrder";
import { PharmacyStock } from "@evara-backend/core/models/pharmacyDashboard/PharmacyStock";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  const conn = await connectMongoDb();
  const session = await conn.startSession();
  session.startTransaction();

  try {
    if (event.pathParameters === null) {
      throw new ErrorMessage(400, "Path parameters are null");
    }

    const orderId = event.pathParameters["id"];
    if (!orderId) {
      throw new ErrorMessage(400, "Id is not provided");
    }

    const order = await InternalOrder.findById(orderId).session(session);
    if (!order) {
      throw new ErrorMessage(404, "Order not found");
    }

    // Ensure the order is in a state that can be rejected
    if (![EInternalOrderStatus.Approved].includes(order.status)) {
      throw new ErrorMessage(
        400,
        "Order cannot be process in its current state"
      );
    }

    // Process each item in the order to finalize stock quantities
    for (const item of order.items) {
      const { item: stockItemId, transferFrom, transferTo, batches } = item;

      const stock = await PharmacyStock.findById(stockItemId).session(session);
      if (!stock) {
        continue; // If no stock found, skip to next item
      }

      // Adjust quantities from on hold to actual locations
      for (const usedBatch of batches) {
        const batch = stock.batches.find(
          (b) => b.batchNo === usedBatch.batchId
        );
        if (!batch) {
          continue; // If no batch matches, skip to the next batch
        }

        const toLocation = batch.locations.find((loc) =>
          (loc.location as unknown as ObjectId).equals(
            transferTo as unknown as ObjectId
          )
        );
        if (toLocation) {
          toLocation.quantity += usedBatch.deductedQuantity; // Update existing location
        } else {
          // Create new location if it does not exist in the transferTo
          batch.locations.push({
            location: transferTo,
            quantity: usedBatch.deductedQuantity,
          });
        }

        // Adjust the quantity on hold
        const fromLocation = batch.locations.find((loc) =>
          (loc.location as unknown as ObjectId).equals(
            transferFrom.location as unknown as ObjectId
          )
        );
        if (fromLocation) {
          stock.quantityOnHold -= usedBatch.deductedQuantity; // Reduce quantity on hold
        }
      }

      await stock.save({ session });
    }

    // Set the order status to Processed
    order.status = EInternalOrderStatus.Processed;
    order.authorizedBy = "Admin";
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    return successResponse(
      "Internal Order processed and quantities transfered successfully"
    );
  } catch (error) {
    console.error("Error handling internal order processing:", error);
    await session.abortTransaction();
    session.endSession();
    return errorResponse(error);
  }
};
