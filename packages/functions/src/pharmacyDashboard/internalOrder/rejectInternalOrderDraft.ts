import { APIGatewayProxyHandler } from "aws-lambda";
import mongoose from "mongoose";
type ObjectId = mongoose.Types.ObjectId; // Using type alias for clarity
import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import {
  EInternalOrderStatus,
  InternalOrder,
} from "@evara-backend/core/models/pharmacyDashboard/InternalOrder";
import { PharmacyStock } from "@evara-backend/core/models/pharmacyDashboard/PharmacyStock";
import errorMessage from "@evara-backend/core/lib/utils/errorMessage";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/lib/utils/successResponse";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  const conn = await connectMongoDb();
  const session = await conn.startSession();
  session.startTransaction();

  try {
    if (event.pathParameters === null) {
      throw new errorMessage(400, "Path parameters are null");
    }

    const orderId = event.pathParameters["id"];
    if (!orderId) {
      throw new errorMessage(400, "Id is not provided");
    }

    const order = await InternalOrder.findById(orderId).session(session);
    if (!order) {
      throw new errorMessage(404, "Order not found");
    }

    // Ensure the order is in a state that can be rejected
    if (
      ![EInternalOrderStatus.Draft, EInternalOrderStatus.Approved].includes(
        order.status
      )
    ) {
      throw new errorMessage(
        400,
        "Order cannot be rejected in its current state"
      );
    }

    // Revert quantities in the PharmacyStock
    for (const item of order.items) {
      const pharmacyStock = await PharmacyStock.findById(item.item).session(
        session
      );
      if (!pharmacyStock) {
        continue; // If no stock found, skip to next item
      }

      for (const usedBatch of item.batches) {
        const batch = pharmacyStock.batches.find(
          (b) => b.batchNo === usedBatch.batchId
        );
        if (batch) {
          const location = batch.locations.find((loc) =>
            (loc.location as unknown as ObjectId).equals(
              item.transferFrom.location as unknown as ObjectId
            )
          );
          if (location) {
            location.quantity += usedBatch.deductedQuantity; // Restore the quantity
            pharmacyStock.quantityOnHold -= usedBatch.deductedQuantity; // Adjust the quantity on hold
          }
        }
      }

      await pharmacyStock.save({ session });
    }

    // Set the order status to rejected
    order.status = EInternalOrderStatus.Rejected;
    order.authorizedBy = "Admin";
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    return successResponse(
      "Internal Order rejected and quantities reverted successfully"
    );
  } catch (error) {
    console.error("Error handling internal order rejection:", error);
    await session.abortTransaction();
    session.endSession();
    return errorResponse(error);
  }
};
