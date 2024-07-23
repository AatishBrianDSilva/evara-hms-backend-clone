import { APIGatewayProxyHandler } from "aws-lambda";
import mongoose from "mongoose";
type ObjectId = mongoose.Types.ObjectId; // Using type alias for clarity

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { PharmacyStock } from "@evara-backend/core/models/pharmacyDashboard/PharmacyStock";
import {
  EPurchaseOrderStatus,
  PurchaseOrder,
} from "@evara-backend/core/src/models/pharmacyDashboard/PurchaseOrder";
import { DrugLocation } from "@evara-backend/core/src/models/pharmacyDashboard/DrugLocation";
import { log } from "console";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const conn = await connectMongoDb();
  const session = await conn.startSession();
  session.startTransaction();
  try {
    log("Updating stock from purchase order");
    if (!event.pathParameters || !event.pathParameters.purchaseOrderId) {
      throw new ErrorMessage(400, "Purchase order ID is required in the URL path");
    }

    const purchaseOrderId = event.pathParameters.purchaseOrderId;

    const purchaseOrder = await PurchaseOrder.findById(purchaseOrderId).session(session);
    // console.log(
    //   "🚀 ~ constmain:APIGatewayProxyHandler= ~ purchaseOrder:",
    //   purchaseOrder
    // );
    if (!purchaseOrder || purchaseOrder.status !== EPurchaseOrderStatus.Ordered) {
      throw new ErrorMessage(404, "Purchase order not found or is not ordered yet.");
    }

    const mainLocation = await DrugLocation.findOne({
      branchId: purchaseOrder.branchId,
      clinicId: purchaseOrder.clinicId,
      main: true,
    }).session(session);
    if (!mainLocation) {
      throw new ErrorMessage(404, "Main location not found for the branch");
    }

    for (const item of purchaseOrder.response.items) {
      const freeQuantityInUnits = (item.freeQuantity || 0) * (item.packSize || 1);
      const totalQuantity = item.quantity + freeQuantityInUnits;

      const existingStock = await PharmacyStock.findOne({
        item: item.item,
        branchId: purchaseOrder.branchId,
        clinicId: purchaseOrder.clinicId,
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
            console.log("Updaintg existing location quantity");
            batch.locations[locationIndex].quantity += item.quantity; // Update existing location quantity
          } else {
            // Add new location
            batch.locations.push({
              location: mainLocation._id,
              quantity: totalQuantity,
            });
          }
        } else {
          // Add new batch
          existingStock.batches.push({
            batchNo: item.batchNo,
            expiryDate: item.expiryDate,
            vendor: purchaseOrder.vendor,
            packSize: item.packSize,
            locations: [
              {
                location: mainLocation._id,
                quantity: totalQuantity,
              },
            ],
          });
        }
        existingStock.sellPrice = item.mrpPerPack;
        await existingStock.save({ session });
      } else {
        // Create new stock
        const newStock = new PharmacyStock({
          branchId: purchaseOrder.branchId,
          clinicId: purchaseOrder.clinicId,
          item: item.item,
          batches: [
            {
              batchNo: item.batchNo,
              expiryDate: item.expiryDate,
              vendor: purchaseOrder.vendor,
              packSize: item.packSize,
              locations: [
                {
                  location: mainLocation._id,
                  quantity: totalQuantity,
                },
              ],
            },
          ],
          sellPrice: item.mrpPerPack,
        });

        await newStock.save({ session });
      }
    }

    // Update purchase order status
    await PurchaseOrder.findByIdAndUpdate(
      purchaseOrderId,
      {
        $set: { status: EPurchaseOrderStatus.Processed },
      },
      {
        session,
      }
    );

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
