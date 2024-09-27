import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { PatientRefund } from "@evara-backend/core/models/patientDashboard/Billings/PatientRefund";
import formatPaginationResult from "@evara-backend/core/src/lib/utils/formatPaginationResult";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb();

    // Extract query parameters for pagination and filtering
    const params = event.queryStringParameters || {};
    const {
      page = "1",
      limit = "25",
      branchId = "",
      startDate,
      endDate,
      patientName = "",
      drugName = "", // Add drugName parameter
    } = params;

    // Calculate skip and limit for pagination
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const pageSize = parseInt(limit, 10);

    // Build match condition for filtering `PatientRefund` collection
    const matchCondition: any = {};

    if (branchId) {
      matchCondition.branchId = branchId; // Filter by branchId if provided
    }

    if (startDate && endDate) {
      matchCondition["refundDetails.refundDate"] = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (drugName) {
      matchCondition["refundDetails.items.itemName"] = { $regex: new RegExp(drugName, "i") }; // Filter by drugName
    }

    // Aggregation pipeline for fetching the required data
    const aggregationPipeline = [
      { $match: matchCondition }, // Apply match conditions
      {
        $unwind: "$refundDetails.items", // Unwind items in refundDetails
      },
      {
        $match: {
          "refundDetails.items.batchNo": { $exists: true, $ne: null, $ne: "N/A" }, // Check for valid batchNo existence
        },
      },
      {
        $lookup: {
          from: "drugItem", // Join with drugItem collection
          localField: "refundDetails.items.itemName", // Field in refundDetails.items to match drug name
          foreignField: "name", // Field in drugItem collection to match
          as: "drugItemInfo", // Name for joined data
        },
      },
      { $unwind: { path: "$drugItemInfo", preserveNullAndEmptyArrays: true } }, // Unwind drugItemInfo array
      {
        $lookup: {
          from: "patients", // Join with Patient collection
          localField: "patientCode", // Field in PatientRefund to match
          foreignField: "patientId", // Field in Patient to match
          as: "patientInfo",
        },
      },
      { $unwind: { path: "$patientInfo", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          patientName: { $concat: ["$patientInfo.firstName", " ", "$patientInfo.lastName"] },
          patientNumber: "$patientInfo.mobile",
          caseNumber: "$patientInfo.caseNumber", // Assuming caseNumber is stored in patientInfo
          drugName: "$refundDetails.items.itemName",
          drugCode: "$refundDetails.items._id", // Assuming itemCode represents Drug Code
          hsnCode: "$drugItemInfo.hsnCode", // Fetching hsnCode from drugItemInfo
          refundAmount: "$refundDetails.refundAmount",
          quantity: "$refundDetails.items.qtyToRefund", // Quantity to refund from items
          unitMRP: "$drugItemInfo.mrp", // Fetching mrp from drugItemInfo
          expiryDate: "$refundDetails.items.expiryDate", // Expiry Date from items
          totalValue: "$refundDetails.items.amountToRefund", // Amount to refund from items
          returnedBy: "$refundDetails.returnedBy", // Assuming returnedBy field is in refundDetails
          branch: "$branchId", // Branch ID from root level
          returnedDate: "$refundDetails.refundDate", // Refund Date as Returned Date
        },
      },
      {
        $project: {
          branch: 1, // Branch ID
          returnedDate: 1, // Returned Date
          patientName: 1, // Patient Name
          patientNumber: 1, // Patient Number
          caseNumber: 1, // Case Number
          drugName: 1, // Drug Name
          drugCode: 1, // Drug Code
          hsnCode: 1, // HSN Code from drugItem
          quantity: 1, // Quantity
          unitMRP: 1, // Unit MRP from drugItem
          expiryDate: 1, // Expiry Date
          totalValue: 1, // Value
        },
      },
      // Filter by patient name if provided
      ...(patientName
        ? [
            {
              $match: {
                patientName: { $regex: new RegExp(patientName, "i") },
              },
            },
          ]
        : []),
      { $sort: { returnedDate: -1 } }, // Sort by returned date in descending order
      { $skip: skip }, // Apply pagination
      { $limit: pageSize },
    ];

    // Fetch the aggregated data
    const refundReport = await PatientRefund.aggregate(aggregationPipeline);

    // Get the total count for pagination (apply match conditions)
    const totalDocs = await PatientRefund.countDocuments({
      ...matchCondition,
      "refundDetails.items.batchNo": { $exists: true, $ne: null, $ne: "N/A" }, // Apply batchNo check with "N/A"
    });
    const totalPages = Math.ceil(totalDocs / pageSize);

    // Format the final result with pagination information
    const paginatedResult = formatPaginationResult({
      docs: refundReport,
      totalDocs,
      totalPages,
      currentPage: parseInt(page, 10),
    });

    // Return the formatted result
    return successResponse("Refund report fetched successfully", paginatedResult);
  } catch (error) {
    console.error("Error fetching refund report: ", error);
    return errorResponse(error);
  }
};
