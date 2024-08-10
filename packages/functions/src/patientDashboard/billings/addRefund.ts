// import { APIGatewayProxyHandler } from "aws-lambda";
// import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
// import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
// import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
// import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
// import {
//   EPatientBillingStatus,
//   PatientBilling,
// } from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling";
// import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";

// // Handler function
// export const main: APIGatewayProxyHandler = async (event, _context) => {
//   _context.callbackWaitsForEmptyEventLoop = false;

//   console.log("Starting addRefund function...");

//   const auth = extractAuthorizerDetails(event);
//   console.log("Authorization details extracted:", auth);

//   const conn = await connectMongoDb();
//   console.log("MongoDB connection established.");

//   const session = await conn.startSession();
//   session.startTransaction();
//   console.log("Transaction started.");

//   try {
//     if (!event.body) {
//       console.error("No data provided in request body.");
//       throw new ErrorMessage(400, "Data is required");
//     }

//     const { billingId, refundAmount, refundDetails } = JSON.parse(event.body);
//     const { method, reason, charges, items } = refundDetails;

//     console.log("Parsed request body:", { billingId, refundAmount, refundDetails });

//     if (!billingId || !refundAmount || !method || !reason) {
//       console.error("Missing required fields:", { billingId, refundAmount, method, reason });
//       throw new ErrorMessage(400, "Missing required fields");
//     }

//     const billing = await PatientBilling.findOne({ billingId }).session(session);

//     if (!billing) {
//       console.error("Billing not found for ID:", billingId);
//       throw new ErrorMessage(404, "Billing not found");
//     }

//     console.log("Billing found:", billing);

//     // Calculate net amount
//     const netAmount = refundAmount + (charges || 0);

//     // Update the total refunded amount with net amount
//     billing.totalRefunded += netAmount;
//     console.log("Updated total refunded amount:", billing.totalRefunded);

//     // Update the status to Refunded
//     billing.status = EPatientBillingStatus.Refunded;
//     console.log("Updated billing status to Refunded.");

//     // Add refund details to the refundDetails array
//     const refundEntry = {
//       refundAmount: netAmount,
//       method,
//       reason,
//       refundDate: new Date(),
//       charges: charges || 0,
//       items: items.map((item: any) => ({
//         serviceName: item.serviceName,
//         itemName: item.itemName,
//         batchNo: item.batchNo,
//         qtyToRefund: item.qtyToRefund,
//         amountToRefund: item.amountToRefund,
//       })),
//     };

//     billing.refundDetails.push(refundEntry);
//     console.log("Added refund details:", refundEntry);

//     await billing.save({ session });
//     console.log("Billing saved successfully.");

//     await session.commitTransaction();
//     console.log("Transaction committed successfully.");

//     return successResponse("Refund added successfully");
//   } catch (error) {
//     console.error("Error occurred during refund process:", error);
//     await session.abortTransaction();
//     console.log("Transaction aborted due to error.");
//     return errorResponse(error);
//   } finally {
//     session.endSession();
//     console.log("Session ended.");
//   }
// };

// import { APIGatewayProxyHandler } from "aws-lambda";
// import mongoose from "mongoose";
// import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
// import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
// import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
// import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
// import {
//   EPatientBillingStatus,
//   PatientBilling,
// } from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling";
// import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";
// import { PharmacyStock } from "@evara-backend/core/models/pharmacyDashboard/PharmacyStock";
// import { DrugLocation } from "@evara-backend/core/src/models/pharmacyDashboard/DrugLocation";
// import { log } from "console";

// // Handler function
// export const main: APIGatewayProxyHandler = async (event, _context) => {
//   _context.callbackWaitsForEmptyEventLoop = false;

//   console.log("Starting addRefund function...");

//   const auth = extractAuthorizerDetails(event);
//   console.log("Authorization details extracted:", auth);

//   const conn = await connectMongoDb();
//   console.log("MongoDB connection established.");

//   const session = await conn.startSession();
//   session.startTransaction();
//   console.log("Transaction started.");

//   try {
//     if (!event.body) {
//       console.error("No data provided in request body.");
//       throw new ErrorMessage(400, "Data is required");
//     }

//     const { billingId, refundAmount, refundDetails, pharmacyData } = JSON.parse(event.body);
//     const { method, reason, charges, items } = refundDetails;

//     console.log("Parsed request body:", { billingId, refundAmount, refundDetails });

//     if (!billingId || !refundAmount || !method || !reason) {
//       console.error("Missing required fields:", { billingId, refundAmount, method, reason });
//       throw new ErrorMessage(400, "Missing required fields");
//     }

//     const billing = await PatientBilling.findOne({ billingId }).session(session);

//     if (!billing) {
//       console.error("Billing not found for ID:", billingId);
//       throw new ErrorMessage(404, "Billing not found");
//     }

//     console.log("Billing found:", billing);

//     // Calculate net amount
//     const netAmount = refundAmount;

//     // Update the total refunded amount with net amount
//     billing.totalRefunded += netAmount;
//     console.log("Updated total refunded amount:", billing.totalRefunded);

//     // Update the status to Refunded
//     billing.status = EPatientBillingStatus.Refunded;
//     console.log("Updated billing status to Refunded.");

//     // Add refund details to the refundDetails array
//     const refundEntry = {
//       refundAmount: netAmount,
//       method,
//       reason,
//       refundDate: new Date(),
//       charges: charges || 0,
//       items: items.map((item: any) => ({
//         serviceName: item.serviceName,
//         itemName: item.itemName,
//         batchNo: item.batchNo,
//         qtyToRefund: item.qtyToRefund,
//         amountToRefund: item.amountToRefund,
//       })),
//     };

//     billing.refundDetails.push(refundEntry);
//     console.log("Added refund details:", refundEntry);

//     // If the billType is Pharmacy and pharmacyData is present, update the stock
//     if (billing.billType === "Pharmacy" && Array.isArray(pharmacyData)) {
//       console.log("Bill type is Pharmacy, updating stock...");

//       const mainLocation = await DrugLocation.findOne({
//         branchId: billing.branchId,
//         clinicId: billing.clinicId,
//         main: true,
//       }).session(session);

//       if (!mainLocation) {
//         throw new ErrorMessage(404, "Main location not found for the branch");
//       }

//       for (const item of pharmacyData) {
//         const { item: itemDetails, details } = item;

//         if (Array.isArray(details)) {
//           for (const detail of details) {
//             console.log(`Processing stock update for item ${itemDetails._id}`);
//             console.log(`Batch Number: ${detail.batchNumber}`);
//             console.log(`Location: ${mainLocation._id}`);
//             console.log(`Quantity to Update: ${detail.quantity}`);

//             const existingStock = await PharmacyStock.findOne({
//               item: itemDetails._id,
//               branchId: billing.branchId,
//               clinicId: billing.clinicId,
//             }).session(session);

//             if (existingStock) {
//               console.log("Existing stock found for item:", itemDetails._id);

//               const existingBatchIndex = existingStock.batches.findIndex(
//                 (batch) => batch.batchNo === detail.batchNumber
//               );

//               if (existingBatchIndex > -1) {
//                 const batch = existingStock.batches[existingBatchIndex];
//                 const locationIndex = batch.locations.findIndex((loc) =>
//                   (loc.location as unknown as mongoose.Types.ObjectId).equals(mainLocation._id)
//                 );

//                 if (locationIndex > -1) {
//                   console.log("Updating quantity for existing location...");
//                   batch.locations[locationIndex].quantity += detail.quantity;
//                 } else {
//                   console.log("Adding new location entry for batch...");
//                   batch.locations.push({
//                     location: mainLocation._id,
//                     quantity: detail.quantity,
//                   });
//                 }
//               } else {
//                 console.log("Adding new batch entry for item...");
//                 existingStock.batches.push({
//                   batchNo: detail.batchNumber,
//                   expiryDate: detail.expiryDate || new Date("2025-01-01"), // TODO: Replace with actual expiry date
//                   vendor: new mongoose.Types.ObjectId(), // TODO: Replace with actual vendor ObjectId
//                   packSize: 1, // TODO: Replace with actual pack size
//                   locations: [{ location: mainLocation._id, quantity: detail.quantity }],
//                 });
//               }
//               console.log("Saving updated stock...");
//               await existingStock.save({ session });
//             } else {
//               console.log("Creating new stock entry for item:", itemDetails._id);

//               const newStock = new PharmacyStock({
//                 branchId: billing.branchId,
//                 clinicId: billing.clinicId,
//                 item: itemDetails._id,
//                 batches: [
//                   {
//                     batchNo: detail.batchNumber,
//                     expiryDate: detail.expiryDate || new Date("2025-01-01"), // TODO: Replace with actual expiry date
//                     vendor: new mongoose.Types.ObjectId(), // TODO: Replace with actual vendor ObjectId
//                     packSize: 1, // TODO: Replace with actual pack size
//                     locations: [{ location: mainLocation._id, quantity: detail.quantity }],
//                   },
//                 ],
//               });

//               console.log("Saving new stock entry...");
//               await newStock.save({ session });
//             }
//           }
//         } else {
//           console.error("Details is not an array for pharmacy item:", item);
//         }
//       }
//     } else {
//       console.warn("No pharmacyData found or billType is not Pharmacy.");
//     }

//     await billing.save({ session });
//     console.log("Billing saved successfully.");

//     await session.commitTransaction();
//     console.log("Transaction committed successfully.");

//     return successResponse("Refund added and stock updated successfully.");
//   } catch (error) {
//     console.error("Error occurred during refund process:", error);
//     await session.abortTransaction();
//     console.log("Transaction aborted due to error.");
//     return errorResponse(error);
//   } finally {
//     session.endSession();
//     console.log("Session ended.");
//   }
// };

import { APIGatewayProxyHandler } from "aws-lambda";
import mongoose from "mongoose";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import {
  EPatientBillingStatus,
  PatientBilling,
} from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling";
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";
import { PharmacyStock } from "@evara-backend/core/models/pharmacyDashboard/PharmacyStock";
import { DrugLocation } from "@evara-backend/core/src/models/pharmacyDashboard/DrugLocation";
import { log } from "console";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  console.log("Starting addRefund function...");

  const auth = extractAuthorizerDetails(event);
  console.log("Authorization details extracted:", auth);

  const conn = await connectMongoDb();
  console.log("MongoDB connection established.");

  const session = await conn.startSession();
  session.startTransaction();
  console.log("Transaction started.");

  try {
    if (!event.body) {
      console.error("No data provided in request body.");
      throw new ErrorMessage(400, "Data is required");
    }

    const { billingId, refundAmount, refundDetails, pharmacyData } = JSON.parse(event.body);
    const { method, reason, charges, items } = refundDetails;

    console.log("Parsed request body:", { billingId, refundAmount, refundDetails });

    if (!billingId || !refundAmount || !method || !reason) {
      console.error("Missing required fields:", { billingId, refundAmount, method, reason });
      throw new ErrorMessage(400, "Missing required fields");
    }

    const billing = await PatientBilling.findOne({ billingId }).session(session);

    if (!billing) {
      console.error("Billing not found for ID:", billingId);
      throw new ErrorMessage(404, "Billing not found");
    }

    console.log("Billing found:", billing);

    // Calculate net amount
    const netAmount = refundAmount;

    // Update the total refunded amount with net amount
    billing.totalRefunded += netAmount;
    console.log("Updated total refunded amount:", billing.totalRefunded);

    // Update the status to Refunded
    billing.status = EPatientBillingStatus.Refunded;
    console.log("Updated billing status to Refunded.");

    // Add refund details to the refundDetails array
    const refundEntry = {
      refundAmount: netAmount,
      method,
      reason,
      refundDate: new Date(),
      charges: charges || 0,
      items: items.map((item: any) => ({
        serviceName: item.serviceName,
        itemName: item.itemName,
        batchNo: item.batchNo,
        qtyToRefund: item.qtyToRefund,
        amountToRefund: item.amountToRefund,
      })),
    };

    billing.refundDetails.push(refundEntry);
    console.log("Added refund details:", refundEntry);

    // If the billType is Pharmacy and pharmacyData is present, update the stock
    if (billing.billType === "Pharmacy" && Array.isArray(pharmacyData)) {
      console.log("Bill type is Pharmacy, updating stock...");

      const mainLocation = await DrugLocation.findOne({
        branchId: billing.branchId,
        clinicId: billing.clinicId,
        main: true,
      }).session(session);

      if (!mainLocation) {
        throw new ErrorMessage(404, "Main location not found for the branch");
      }

      for (const item of pharmacyData) {
        const { item: itemDetails, details } = item;

        if (Array.isArray(details)) {
          for (const detail of details) {
            console.log(`Processing stock update for item ${itemDetails._id}`);
            console.log(`Batch Number: ${detail.batchNumber}`);
            console.log(`Location: ${mainLocation._id}`);
            console.log(`Quantity to Update: ${detail.quantity}`);

            const existingStock = await PharmacyStock.findOne({
              item: itemDetails._id,
              branchId: billing.branchId,
              clinicId: billing.clinicId,
            }).session(session);

            if (existingStock) {
              console.log("Existing stock found for item:", itemDetails._id);

              const existingBatchIndex = existingStock.batches.findIndex(
                (batch) => batch.batchNo === detail.batchNumber
              );

              if (existingBatchIndex > -1) {
                const batch = existingStock.batches[existingBatchIndex];
                const locationIndex = batch.locations.findIndex((loc) =>
                  (loc.location as unknown as mongoose.Types.ObjectId).equals(mainLocation._id)
                );

                if (locationIndex > -1) {
                  const currentQuantity = batch.locations[locationIndex].quantity;
                  console.log(`Current Quantity at Location: ${currentQuantity}`);

                  batch.locations[locationIndex].quantity += detail.quantity;

                  console.log(
                    `Updated Quantity at Location: ${batch.locations[locationIndex].quantity}`
                  );
                } else {
                  console.log("Adding new location entry for batch...");
                  batch.locations.push({
                    location: mainLocation._id,
                    quantity: detail.quantity,
                  });

                  console.log(`New Quantity at Location: ${detail.quantity}`);
                }
              } else {
                console.log("Adding new batch entry for item...");
                existingStock.batches.push({
                  batchNo: detail.batchNumber,
                  expiryDate: detail.expiryDate || new Date("2025-01-01"), // TODO: Replace with actual expiry date
                  vendor: new mongoose.Types.ObjectId(), // TODO: Replace with actual vendor ObjectId
                  packSize: 1, // TODO: Replace with actual pack size
                  locations: [{ location: mainLocation._id, quantity: detail.quantity }],
                });

                console.log(`New Batch Added with Quantity: ${detail.quantity}`);
              }
              console.log("Saving updated stock...");
              await existingStock.save({ session });
            } else {
              console.log("Creating new stock entry for item:", itemDetails._id);

              const newStock = new PharmacyStock({
                branchId: billing.branchId,
                clinicId: billing.clinicId,
                item: itemDetails._id,
                batches: [
                  {
                    batchNo: detail.batchNumber,
                    expiryDate: detail.expiryDate || new Date("2025-01-01"), // TODO: Replace with actual expiry date
                    vendor: new mongoose.Types.ObjectId(), // TODO: Replace with actual vendor ObjectId
                    packSize: 1, // TODO: Replace with actual pack size
                    locations: [{ location: mainLocation._id, quantity: detail.quantity }],
                  },
                ],
              });

              console.log("Saving new stock entry...");
              await newStock.save({ session });
              console.log(`New Stock Created with Quantity: ${detail.quantity}`);
            }
          }
        } else {
          console.error("Details is not an array for pharmacy item:", item);
        }
      }
    } else {
      console.warn("No pharmacyData found or billType is not Pharmacy.");
    }

    await billing.save({ session });
    console.log("Billing saved successfully.");

    await session.commitTransaction();
    console.log("Transaction committed successfully.");

    return successResponse("Refund added and stock updated successfully.");
  } catch (error) {
    console.error("Error occurred during refund process:", error);
    await session.abortTransaction();
    console.log("Transaction aborted due to error.");
    return errorResponse(error);
  } finally {
    session.endSession();
    console.log("Session ended.");
  }
};
