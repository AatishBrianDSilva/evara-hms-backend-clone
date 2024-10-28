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
import SNSService from "@evara-backend/core/lib/aws/sns";
import {
  EBuckets,
  EDocumentTypes,
  EReportTemplateTypes,
  IReportData,
} from "@evara-backend/core/lib/types/global";
import _ from "lodash";
import Branch from "@evara-backend/core/models/mastersDashboard/global/ClinicBranches";

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

    const { billingId, refundAmount, refundDetails, pharmacyData, patientId } =
      JSON.parse(event.body);
    const { method, reason, charges, items, refundNumber, files } =
      refundDetails;

    console.log("Parsed request body:", {
      billingId,
      refundAmount,
      refundDetails,
      pharmacyData,
    });

    if (!billingId || !refundAmount || !method || !reason) {
      console.error("Missing required fields:", {
        billingId,
        refundAmount,
        method,
        reason,
      });
      throw new ErrorMessage(400, "Missing required fields");
    }

    const billing = await PatientBilling.findOne({ billingId }).session(
      session
    );

    if (!billing) {
      console.error("Billing not found for ID:", billingId);
      throw new ErrorMessage(404, "Billing not found");
    }

    console.log("Billing found:", billing);

    // Log the pharmacyData to check its contents
    console.log(
      "Pharmacy Data received in the request:",
      JSON.stringify(pharmacyData, null, 2)
    );

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
        refundNumber: refundNumber || "N/A", // Default value if refundNumber is not provided
        files: files || [], // Default to an empty array if files are not provided
      },
      createdBy: auth.username,
      branchId: billing.branchId,
      clinicId: billing.clinicId,
    });

    await refundEntry.save({ session });
    console.log("PatientRefund entry saved successfully.");

    // If the billType is "Pharmacy," extract pharmacy data and update stock
    if (
      billing.billType === "Pharmacy" &&
      pharmacyData &&
      Array.isArray(pharmacyData)
    ) {
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
        const itemDetails = pharmacyItem.details;

        if (!Array.isArray(itemDetails) || itemDetails.length === 0) {
          console.error("Item details array is missing or empty:", itemDetails);
          throw new ErrorMessage(
            400,
            "Missing required fields in pharmacy item details"
          );
        }

        // Iterate through the details array and update stock
        for (const detail of itemDetails) {
          console.log("Raw detail from payload:", detail);

          const itemId = detail.itemId; // Use itemId from detail
          const {
            expiryDate,
            vendor,
            packSize,
            batchNumber,
            location,
            quantity,
          } = detail;

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
            throw new ErrorMessage(
              400,
              "Missing required fields in pharmacy item details"
            );
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
                (loc.location as unknown as mongoose.Types.ObjectId).equals(
                  location
                )
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

    const branchId = auth.branchId;
    const clinicId = auth.clinicId;
    console.log("Extracted Branch ID:", branchId);
    console.log("Extracted Clinic ID:", clinicId);

    // Fetch the branch using the branchId and clinicId from the auth details
    const branch = await Branch.findOne({
      code: new RegExp(`^${branchId.trim()}\\s*$`, "i"),
      clinicId: clinicId,
      isActive: true,
    }).lean();

    if (!branch) {
      console.log("Branch not found");
      throw new ErrorMessage(404, "Branch not found");
    }

    // Generate report after successful transaction
    const reportData = generateReportData(
      refundEntry,
      auth.clinicId,
      patientId,
      branch
    );
    console.log("Report Data: ", JSON.stringify(reportData, null, 2));

    // Send to SNS
    await SNSService.publishMessage({
      Message: JSON.stringify(reportData),
      TopicArn: process.env.REPORT_HTML_GENERATION_TOPIC_ARN,
    });

    return successResponse(
      "Refund added, stock updated, and report generated successfully"
    );
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

// Function to generate report data
const generateReportData = (
  refundEntry: any,
  clinicId: string,
  patientId: string,
  branch: any
) => {
  const reportData: IReportData = {
    bucket: EBuckets.UserReports,
    documentType: EDocumentTypes.Refund,
    templateType: EReportTemplateTypes.Refund,
    doctor: "N/A", //refund is not related to doctor
    patient: patientId,
    clinic: clinicId,
    sections: [],
    reportName: `Refund Report for ${refundEntry.patientCode}`,
    fileName: _.kebabCase(
      `refund-${refundEntry.patientCode}-${refundEntry._id}`
    ),
    reportId: refundEntry._id,
  };

  // Add refund details section
  reportData.sections.push({
    showTitle: true,
    title: "Refund Details",
    content: {
      RefundNumber: refundEntry.refundDetails.refundNumber || "N/A",
      Method: refundEntry.refundDetails.method,
      Reason: refundEntry.refundDetails.reason,
      Amount: refundEntry.refundDetails.refundAmount,
      Charges: refundEntry.refundDetails.charges,
      // Files: refundEntry.refundDetails.files.join(", "),
    },
  });

  // Check if branch has a valid address and format it
  let branchAddress = "Address not available";
  if (branch && branch.address) {
    const { street, city, state, zip } = branch.address;
    branchAddress = `${street ? street + ", " : ""}${city ? city + ", " : ""}${
      state ? state + " - " : ""
    }${zip || ""}`;
  }

  // Add Branch Address section
  const branchDetails = {
    Branch: branch.branchName || "N/A",
    Address: branchAddress,
    Phone: branch.phone || "N/A",
    Email: branch.email || "N/A",
  };

  reportData.sections.push({
    showTitle: true,
    title: "Branch Details",
    content: branchDetails,
  });

  // Add each item refunded as a section
  refundEntry.refundDetails.items.forEach((item: any, index: number) => {
    reportData.sections.push({
      showTitle: true,
      title: `Refunded Item ${index + 1}`,
      content: {
        ServiceName: item.serviceName,
        ItemName: item.itemName,
        BatchNo: item.batchNo,
        QuantityRefunded: item.qtyToRefund,
        AmountRefunded: item.amountToRefund,
      },
    });
  });

  return reportData;
};
