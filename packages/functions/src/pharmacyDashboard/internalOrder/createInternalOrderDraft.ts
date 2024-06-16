import { APIGatewayProxyHandler } from "aws-lambda";
import mongoose from "mongoose";
type ObjectId = mongoose.Types.ObjectId; // Using type alias for clarity

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import { InternalOrder } from "@evara-backend/core/models/pharmacyDashboard/InternalOrder";
import { PharmacyStock } from "@evara-backend/core/models/pharmacyDashboard/PharmacyStock";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const conn = await connectMongoDb();
  const session = await conn.startSession();
  session.startTransaction();

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, "Unauthorized");
    }

    if (!event.body) {
      throw new ErrorMessage(400, "Data is required");
    }

    const { items, date } = JSON.parse(event.body);
    console.log("Items:", items);

    const branchId = auth.branchId;
    const clinicId = auth.clinicId;

    if (!items || !items.length) {
      throw new ErrorMessage(400, "Items are required in the order");
    }

    // Process each item in the order
    for (const item of items) {
      const { item: stockItem, quantity, transferFrom, transferTo } = item;

      // Fetch the stock entry with batch and location details
      const stock = await PharmacyStock.findOne(
        {
          branchId,
          clinicId,
          _id: stockItem,
          "batches.locations.location": transferFrom.location,
        },
        null,
        { session }
      ).exec();

      // console.log("Stock:", JSON.stringify(stock, null, 2));

      if (!stock) {
        throw new ErrorMessage(404, "Item not found in stock");
      }

      // Find the batch and location to decrement the quantity from
      let remainingQuantity = quantity;

      const usedBatches = [];

      for (let batch of stock.batches) {
        console.log("Batch:", JSON.stringify(batch, null, 2));
        for (let location of batch.locations) {
          if (
            (location.location as unknown as ObjectId).equals(
              transferFrom.location
            )
          ) {
            if (location.quantity >= remainingQuantity) {
              // This location can cover the entire remaining quantity
              location.quantity -= remainingQuantity;
              stock.quantityOnHold += remainingQuantity;
              usedBatches.push({
                batchId: batch.batchNo,
                deductedQuantity: remainingQuantity,
              });
              remainingQuantity = 0; // Set remaining quantity to 0 as it's fully covered

              break; // No need to check further
            } else {
              // This location cannot cover the entire remaining quantity
              stock.quantityOnHold += location.quantity;
              remainingQuantity -= location.quantity;
              usedBatches.push({
                batchId: batch.batchNo,
                deductedQuantity: location.quantity,
              });
              location.quantity = 0; // This location is now fully depleted
            }
          }
        }

        if (remainingQuantity === 0) break; // Break out of the loop if the required quantity has been fully deducted
      }

      if (remainingQuantity > 0) {
        throw new ErrorMessage(
          400,
          "Insufficient stock across all batches at the specified location."
        );
      }

      await stock.save({ session });

      // Add batch and location details to item for internal tracking
      item.batches = usedBatches;
    }

    const createdBy = "User 1";

    // Create and save the internal order
    const internalOrder = new InternalOrder({
      items,
      clinicId,
      branchId,
      createdBy,
      date: date,
    });
    await internalOrder.save({ session });

    await session.commitTransaction();
    session.endSession();

    return successResponse(
      "Internal Order added and quantities updated successfully"
    );
  } catch (error) {
    console.error("Error handling internal order:", error);
    await session.abortTransaction();
    session.endSession();
    return errorResponse(error);
  }
};
