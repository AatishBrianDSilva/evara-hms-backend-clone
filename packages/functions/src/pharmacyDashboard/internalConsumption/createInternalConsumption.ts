import { APIGatewayProxyHandler } from "aws-lambda";
import mongoose from "mongoose";
type ObjectId = mongoose.Types.ObjectId;

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import { InternalConsumption } from "@evara-backend/core/models/pharmacyDashboard/InternalConsumption";
import { PharmacyStock } from "@evara-backend/core/models/pharmacyDashboard/PharmacyStock";
import { User } from "@evara-backend/core/models/User"; // Import the User model
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  // Connect to MongoDB and start a session for transaction
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
      throw new ErrorMessage(400, "Items are required in the consumption");
    }

    // Process each item in the consumption request
    for (const item of items) {
      const { item: stockItem, quantity, transferFrom } = item;

      // Find the stock item with the specified batch and location
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

      if (!stock) {
        throw new ErrorMessage(404, "Item not found in stock");
      }

      let remainingQuantity = quantity;
      const usedBatches = [];

      // Deduct the quantity from the batches and locations
      for (let batch of stock.batches) {
        for (let location of batch.locations) {
          if ((location.location as unknown as ObjectId).equals(transferFrom.location)) {
            if (location.quantity >= remainingQuantity) {
              // If location has enough quantity, deduct and break
              location.quantity -= remainingQuantity;
              usedBatches.push({
                batchId: batch.batchNo,
                deductedQuantity: remainingQuantity,
              });
              remainingQuantity = 0;
              break;
            } else {
              // If location doesn't have enough, deduct what it has and continue
              remainingQuantity -= location.quantity;
              usedBatches.push({
                batchId: batch.batchNo,
                deductedQuantity: location.quantity,
              });
              location.quantity = 0;
            }
          }
        }
        if (remainingQuantity === 0) break;
      }

      // If not enough stock in all batches, throw an error
      if (remainingQuantity > 0) {
        throw new ErrorMessage(
          400,
          "Insufficient stock across all batches at the specified location."
        );
      }

      // Save the updated stock document
      await stock.save({ session });
      item.batches = usedBatches;
    }

    // Fetch the user's name
    const user = await User.findById(auth.userId).exec();
    if (!user) {
      throw new ErrorMessage(404, "User not found");
    }

    // Create internal consumption
    const createdBy = user.username; // Use the user's name
    const internalConsumption = new InternalConsumption({
      items,
      clinicId,
      branchId,
      createdBy,
      date: date,
    });

    await internalConsumption.save({ session });

    await session.commitTransaction();
    session.endSession();

    return successResponse("Internal Consumption added and Stock updated successfully");
  } catch (error) {
    console.error("Error handling internal consumption:", error);
    await session.abortTransaction();
    session.endSession();
    return errorResponse(error);
  }
};
