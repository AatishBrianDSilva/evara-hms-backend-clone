import { APIGatewayProxyHandler } from "aws-lambda";
import mongoose from "mongoose";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { PatientBilling } from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling";
import { PatientRefund } from "@evara-backend/core/src/models/patientDashboard/Billings/PatientRefund";
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";
import { PharmacyStock } from "@evara-backend/core/models/pharmacyDashboard/PharmacyStock";
import { DrugLocation } from "@evara-backend/core/src/models/pharmacyDashboard/DrugLocation";

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

    console.log("Parsed request body:", { billingId, refundAmount, refundDetails, pharmacyData });

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

    // Log the pharmacyData to check its contents
    console.log("Pharmacy Data received in the request:", JSON.stringify(pharmacyData, null, 2));

    // Calculate and update the total refunded amount
    const netAmount = refundAmount;
    billing.totalRefunded = netAmount;
    console.log("Updated total refunded amount:", billing.totalRefunded);

    // Save the billing record (no status change)
    await billing.save({ session });
    console.log("Billing saved successfully.");

    // Create a new refund entry in the PatientRefund table
    const refundEntry = new PatientRefund({
      billingId: billing._id,
      patientCode: billing.patientCode,
      refundDetails: {
        refundAmount: netAmount,
        method,
        reason,
        refundDate: new Date(),
        charges: charges || 0,
        items: items.map((item: any) => ({
          serviceName: item.serviceName,
          itemName: item.itemName,
          batchNo: billing.billType === "Pharmacy" ? item.batchNo : "N/A", // Set batchNo as "N/A" for non-pharmacy items
          qtyToRefund: item.qtyToRefund,
          amountToRefund: item.amountToRefund,
        })),
      },
      createdBy: auth.userId,
      branchId: billing.branchId,
      clinicId: billing.clinicId,
    });

    await refundEntry.save({ session });
    console.log("PatientRefund entry saved successfully.");

    // If the billType is "Pharmacy," extract pharmacy data and update stock
    if (billing.billType === "Pharmacy" && pharmacyData && Array.isArray(pharmacyData)) {
      console.log("Bill type is Pharmacy, updating stock...");

      const mainLocation = await DrugLocation.findOne({
        branchId: billing.branchId,
        clinicId: billing.clinicId,
        main: true,
      }).session(session);

      if (!mainLocation) {
        throw new ErrorMessage(404, "Main location not found for the branch");
      }

      // Iterate over each pharmacyData entry and update stock
      for (let i = 0; i < pharmacyData.length; i++) {
        const pharmacyItem = pharmacyData[i];
        const { item } = pharmacyItem;
        const itemDetails = pharmacyItem.details;

        if (!Array.isArray(itemDetails) || itemDetails.length === 0) {
          console.error("Item details array is missing or empty:", itemDetails);
          throw new ErrorMessage(400, "Missing required fields in pharmacy item details");
        }

        // Iterate through the details array and update stock
        for (const detail of itemDetails) {
          console.log("Raw detail from payload:", detail);

          const itemId = detail.itemId; // Use itemId from detail
          const { expiryDate, vendor, packSize, batchNumber, location, quantity } = detail;

          console.log("Mapped pharmacy item details:", {
            itemId,
            expiryDate,
            vendor,
            packSize,
            batchNumber,
            location,
            quantity,
          });

          if (!itemId || !expiryDate || !vendor || !packSize) {
            console.error("Missing required fields in item:", {
              itemId,
              expiryDate,
              vendor,
              packSize,
            });
            throw new ErrorMessage(400, "Missing required fields in pharmacy item details");
          }

          const existingStock = await PharmacyStock.findOne({
            item: itemId,
            branchId: billing.branchId,
            clinicId: billing.clinicId,
          }).session(session);

          if (existingStock) {
            const existingBatchIndex = existingStock.batches.findIndex(
              (batch) => batch.batchNo === batchNumber
            );

            if (existingBatchIndex > -1) {
              const batch = existingStock.batches[existingBatchIndex];
              const locationIndex = batch.locations.findIndex((loc) =>
                (loc.location as unknown as mongoose.Types.ObjectId).equals(location)
              );

              if (locationIndex > -1) {
                console.log(
                  `Before update: Item ${itemId}, Location ${location}, Batch ${batchNumber}, Quantity ${batch.locations[locationIndex].quantity}`
                );
                batch.locations[locationIndex].quantity += quantity;
                console.log(
                  `After update: Item ${itemId}, Location ${location}, Batch ${batchNumber}, Quantity ${batch.locations[locationIndex].quantity}`
                );
              } else {
                console.log(
                  `Adding new location for Item ${itemId}, Location ${location}, Batch ${batchNumber}, Quantity ${quantity}`
                );
                batch.locations.push({
                  location: location,
                  quantity,
                });
              }
            } else {
              console.log(
                `Adding new batch for Item ${itemId}, Batch ${batchNumber}, Quantity ${quantity}`
              );
              existingStock.batches.push({
                batchNo: batchNumber,
                expiryDate,
                vendor,
                packSize,
                locations: [{ location: location, quantity }],
              });
            }
            await existingStock.save({ session });
            console.log(`Stock updated for item ${itemId}`);
          } else {
            console.log(
              `Creating new stock entry for Item ${itemId}, Batch ${batchNumber}, Quantity ${quantity}`
            );
            const newStock = new PharmacyStock({
              branchId: billing.branchId,
              clinicId: billing.clinicId,
              item: itemId,
              batches: [
                {
                  batchNo: batchNumber,
                  expiryDate,
                  vendor,
                  packSize,
                  locations: [{ location: location, quantity }],
                },
              ],
            });

            await newStock.save({ session });
            console.log(`New stock created for item ${itemId}`);
          }
        }
      }
    }

    await session.commitTransaction();
    console.log("Transaction committed successfully.");

    return successResponse("Refund added and stock updated successfully");
  } catch (error) {
    await session.abortTransaction();
    console.log("Transaction aborted due to error.");
    console.error("Error occurred during refund process:", error);
    return errorResponse(error);
  } finally {
    session.endSession();
    console.log("Session ended.");
  }
};
