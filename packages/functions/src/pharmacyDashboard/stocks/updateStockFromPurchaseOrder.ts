// updateStockFromPurchaseOrder.ts
import mongoose from 'mongoose';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import { PharmacyStock } from '@evara-backend/core/models/pharmacyDashboard/PharmacyStock';
import {
  EPurchaseOrderStatus,
  PurchaseOrder,
} from '@evara-backend/core/src/models/pharmacyDashboard/PurchaseOrder';
import { DrugLocation } from '@evara-backend/core/src/models/pharmacyDashboard/DrugLocation';
import { log } from 'console';

type ObjectId = mongoose.Types.ObjectId;

export const updateStockFromPurchaseOrder = async (
  purchaseOrderId: string,
  session: mongoose.ClientSession,
) => {
  log(`Processing Purchase Order ID: ${purchaseOrderId}`);

  const purchaseOrder =
    await PurchaseOrder.findById(purchaseOrderId).session(session);
  if (!purchaseOrder) {
    log(`Error: Purchase order not found for ID ${purchaseOrderId}`);
    throw new ErrorMessage(404, 'Purchase order not found.');
  }

  const { responses } = purchaseOrder;
  if (!responses || responses.length === 0) {
    log('Error: No responses found in the purchase order.');
    throw new ErrorMessage(400, 'No responses found in the purchase order.');
  }

  log(`Found ${responses.length} responses in the purchase order`);

  const mainLocation = await DrugLocation.findOne({
    branchId: purchaseOrder.branchId,
    clinicId: purchaseOrder.clinicId,
    main: true,
  }).session(session);
  if (!mainLocation) {
    log(
      `Error: Main location not found for branch ID ${purchaseOrder.branchId}`,
    );
    throw new ErrorMessage(404, 'Main location not found for the branch');
  }

  log(`Main location found: ${mainLocation._id}`);

  let hasProcessedItems = false;

  for (const response of responses) {
    log(`Processing response with status: ${response.status}`);
    if (response.status === 'ProcessedWithoutUpdating') {
      for (const item of response.items) {
        log(`Processing item: ${item.item}`);

        if (!item.batchNo || !item.expiryDate) {
          log(
            `Skipping item ${item.item} due to missing batchNo or expiryDate`,
          );
          continue;
        }

        const freeQuantityInUnits =
          (item.freeQuantity || 0) * (item.packSize || 1);
        const totalQuantity = item.quantity + freeQuantityInUnits;
        log(`Total quantity for item ${item.item}: ${totalQuantity}`);

        const existingStock = await PharmacyStock.findOne({
          item: item.item,
          branchId: purchaseOrder.branchId,
          clinicId: purchaseOrder.clinicId,
        }).session(session);

        if (existingStock) {
          log(`Existing stock found for item ${item.item}`);
          const existingBatchIndex = existingStock.batches.findIndex(
            batch => batch.batchNo === item.batchNo,
          );
          if (existingBatchIndex > -1) {
            log(`Updating existing batch for item ${item.item}`);
            const batch = existingStock.batches[existingBatchIndex];
            const locationIndex = batch.locations.findIndex(loc =>
              (loc.location as unknown as ObjectId).equals(mainLocation._id),
            );

            if (locationIndex > -1) {
              log(`Updating quantity for location ${mainLocation._id}`);
              batch.locations[locationIndex].quantity += totalQuantity;
            } else {
              log(`Adding new location for item ${item.item}`);
              batch.locations.push({
                location: mainLocation._id,
                quantity: totalQuantity,
              });
            }

            // Update sellPrice at batch level
            batch.sellPrice = item.mrpPerPack;

          } else {
            log(`Adding new batch for item ${item.item}`);
            existingStock.batches.push({
              batchNo: item.batchNo,
              expiryDate: item.expiryDate,
              vendor: purchaseOrder.vendor,
              packSize: item.packSize,
              sellPrice: item.mrpPerPack, // Add sellPrice for the new batch

              locations: [
                {
                  location: mainLocation._id,
                  quantity: totalQuantity,
                },
              ],
            });
          }
          // existingStock.sellPrice = item.mrpPerPack;
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
                sellPrice: item.mrpPerPack, // Add sellPrice for the new batch

                locations: [
                  {
                    location: mainLocation._id,
                    quantity: totalQuantity,
                  },
                ],
              },
            ],
            // sellPrice: item.mrpPerPack,
          });

          await newStock.save({ session });
          log(`New stock created for item ${item.item}`);
        }
      }

      hasProcessedItems = true;
      response.status = 'Processed';
      log(`Response marked as processed: ${JSON.stringify(response)}`);
    }
  }

  if (!hasProcessedItems) {
    log('No items were processed from the purchase order response.');
    throw new ErrorMessage(
      400,
      'No items found in the purchase order response.',
    );
  }

  purchaseOrder.status = EPurchaseOrderStatus.Processed;
  await purchaseOrder.save({ session });
  log(`Purchase order ${purchaseOrderId} status updated to Processed`);
};
