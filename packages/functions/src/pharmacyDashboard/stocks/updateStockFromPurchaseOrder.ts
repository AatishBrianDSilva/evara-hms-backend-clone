import { APIGatewayProxyHandler } from "aws-lambda";
import mongoose from "mongoose";
type ObjectId = mongoose.Types.ObjectId; // Using type alias for clarity

import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import errorMessage from "@evara-backend/core/lib/utils/errorMessage";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/lib/utils/successResponse";
import { PharmacyStock } from "@evara-backend/core/models/pharmacyDashboard/PharmacyStock";
import {
  EPurchaseOrderStatus,
  PurchaseOrder,
} from "@evara-backend/core/src/models/pharmacyDashboard/PurchaseOrder";
import { DrugLocation } from "@evara-backend/core/src/models/pharmacyDashboard/DrugLocation";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await connectMongoDb();

    if (event.body == null) {
      throw new errorMessage(400, "Data is required");
    }

    const { purchaseOrderId } = JSON.parse(event.body);

    const purchaseOrder = await PurchaseOrder.findById(purchaseOrderId).session(
      session
    );
    if (
      !purchaseOrder ||
      purchaseOrder.status !== EPurchaseOrderStatus.Approved
    ) {
      throw new errorMessage(
        404,
        "Purchase order not found or is not approved"
      );
    }

    const mainLocation = await DrugLocation.findOne({
      branchId: purchaseOrder.branchId,
      main: true,
    }).session(session);
    if (!mainLocation) {
      throw new errorMessage(404, "Main location not found for the branch");
    }

    for (const item of purchaseOrder.response.items) {
      const existingStock = await PharmacyStock.findOne({
        item: item.item,
        branchId: purchaseOrder.branchId,
      }).session(session);

      if (existingStock) {
        // Update existing stock
        const existingBatchIndex = existingStock.batches.findIndex(
          (batch) => batch.batchNo === item.batchNo
        );
        if (existingBatchIndex > -1) {
          // Batch exists, update quantity
          const batch = existingStock.batches[existingBatchIndex];
          const locationIndex = batch.locations.findIndex((loc) =>
            (loc.location as unknown as ObjectId).equals(mainLocation._id)
          );

          if (locationIndex > -1) {
            batch.locations[locationIndex].quantity += item.quantity; // Update existing location quantity
          } else {
            batch.locations.push({
              location: mainLocation._id,
              quantity: item.quantity,
            });
          }
        } else {
          // Add new batch
          existingStock.batches.push({
            batchNo: item.batchNo,
            expiryDate: item.expiryDate,
            vendor: purchaseOrder.vendor,
            pricePerPack: item.buyPrice,
            packSize: item.packSize,
            sellPrice: item.mrp,
            locations: [
              { location: mainLocation._id, quantity: item.quantity },
            ],
          });
        }
        await existingStock.save({ session });
      } else {
        // Create new stock
        const newStock = new PharmacyStock({
          branchId: purchaseOrder.branchId,
          item: item.item,
          batches: [
            {
              batchNo: item.batchNo,
              expiryDate: item.expiryDate,
              vendor: purchaseOrder.vendor,
              pricePerPack: item.buyPrice,
              packSize: item.packSize,
              sellPrice: item.mrp,
              locations: [
                { location: mainLocation._id, quantity: item.quantity },
              ],
            },
          ],
        });
        await newStock.save({ session });
      }
    }

    // Update purchase order status
    purchaseOrder.status = EPurchaseOrderStatus.Processed;
    await purchaseOrder.save({ session });

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    return successResponse("Stock and purchase order updated successfully.");
  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    session.endSession();
    console.error("Failed to update stock from purchase order:", error);
    return errorResponse(error);
  }
};
