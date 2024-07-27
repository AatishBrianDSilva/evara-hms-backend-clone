import { APIGatewayProxyHandler } from "aws-lambda";
import mongoose from "mongoose";
type ObjectId = mongoose.Types.ObjectId;

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

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const conn = await connectMongoDb();
  const session = await conn.startSession();
  session.startTransaction();
  try {
    log("Starting stock update from partially processed purchase order");

    // Validate the presence of the purchase order ID
    if (!event.pathParameters || !event.pathParameters.purchaseOrderId) {
      log("Error: Purchase order ID is missing in the request");
      throw new ErrorMessage(400, "Purchase order ID is required in the URL path");
    }

    const purchaseOrderId = event.pathParameters.purchaseOrderId;
    log(`Processing Purchase Order ID: ${purchaseOrderId}`);

    // Retrieve the purchase order by ID
    const purchaseOrder = await PurchaseOrder.findById(purchaseOrderId).session(session);
    if (!purchaseOrder) {
      log(`Error: Purchase order not found for ID ${purchaseOrderId}`);
      throw new ErrorMessage(404, "Purchase order not found.");
    }

    // Extract the response containing the items
    const { response } = purchaseOrder;
    if (!response || !response.items) {
      log("Error: No items found in the purchase order response.");
      throw new ErrorMessage(400, "No items found in the purchase order response.");
    }

    log(`Found ${response.items.length} items in the purchase order response`);

    // Retrieve the main location for the branch
    const mainLocation = await DrugLocation.findOne({
      branchId: purchaseOrder.branchId,
      clinicId: purchaseOrder.clinicId,
      main: true,
    }).session(session);
    if (!mainLocation) {
      log(`Error: Main location not found for branch ID ${purchaseOrder.branchId}`);
      throw new ErrorMessage(404, "Main location not found for the branch");
    }

    log(`Main location found: ${mainLocation._id}`);

    // Process only the newly processed items
    for (const item of response.items) {
      log(`Processing item: ${item.item} with status: ${item.status}`);
      if (item.status === "NewlyProcessed") {
        if (!item.batchNo || !item.expiryDate) {
          log(`Skipping item ${item.item} due to missing batchNo or expiryDate`);
          continue; // Skip items with missing batchNo or expiryDate
        }

        const freeQuantityInUnits = (item.freeQuantity || 0) * (item.packSize || 1);
        const totalQuantity = item.quantity + freeQuantityInUnits;
        log(`Total quantity for item ${item.item}: ${totalQuantity}`);

        // Find existing stock for the item
        const existingStock = await PharmacyStock.findOne({
          item: item.item,
          branchId: purchaseOrder.branchId,
          clinicId: purchaseOrder.clinicId,
        }).session(session);

        if (existingStock) {
          log(`Existing stock found for item ${item.item}`);
          // Find the batch index within the existing stock
          const existingBatchIndex = existingStock.batches.findIndex(
            (batch) => batch.batchNo === item.batchNo
          );
          if (existingBatchIndex > -1) {
            log(`Updating existing batch for item ${item.item}`);
            const batch = existingStock.batches[existingBatchIndex];
            // Find the location index within the batch
            const locationIndex = batch.locations.findIndex((loc) =>
              (loc.location as unknown as ObjectId).equals(mainLocation._id)
            );

            if (locationIndex > -1) {
              log(`Updating quantity for location ${mainLocation._id}`);
              // Correctly add totalQuantity to the existing quantity at the location
              batch.locations[locationIndex].quantity += totalQuantity;
            } else {
              log(`Adding new location for item ${item.item}`);
              batch.locations.push({
                location: mainLocation._id,
                quantity: totalQuantity,
              });
            }
          } else {
            log(`Adding new batch for item ${item.item}`);
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
          log(`Stock updated for item ${item.item}`);
        } else {
          log(`Creating new stock entry for item ${item.item}`);
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
          log(`New stock created for item ${item.item}`);
        }

        // Mark item as fully processed after updating stock
        item.status = "Processed";
      } else {
        log(`Skipping item ${item.item} with status: ${item.status}`);
      }
    }

    // Commit transaction
    await session.commitTransaction();
    session.endSession();
    log(`Stock update for newly processed items completed successfully`);

    return successResponse("Stock updated successfully for newly processed items.");
  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    session.endSession();
    console.error("Failed to update stock from purchase order:", error);
    return errorResponse(error);
  }
};
