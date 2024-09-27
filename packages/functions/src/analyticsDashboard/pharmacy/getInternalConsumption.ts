import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { InternalConsumption } from "@evara-backend/core/src/models/pharmacyDashboard/InternalConsumption";
import formatPaginationResult from "@evara-backend/core/src/lib/utils/formatPaginationResult";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb();

    const params = event.queryStringParameters || {};
    const { page = "1", limit = "25", allocDate } = params;

    // Calculate skip and limit for pagination
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const pageSize = parseInt(limit, 10);

    // Build match condition for allocDate filtering
    const matchCondition: any = {};
    if (allocDate) {
      const startOfDay = new Date(allocDate);
      startOfDay.setUTCHours(0, 0, 0, 0); // Start of the day in UTC
      const endOfDay = new Date(allocDate);
      endOfDay.setUTCHours(23, 59, 59, 999); // End of the day in UTC

      matchCondition.date = {
        $gte: startOfDay,
        $lte: endOfDay,
      };
    }

    // Log the match condition for debugging
    console.log("Match Condition for Date Filtering: ", matchCondition);

    // Aggregation pipeline for internal consumption report
    const aggregationPipeline = [
      { $match: matchCondition }, // Apply date filter if provided
      { $unwind: "$items" },
      { $unwind: "$items.batches" },
      {
        $lookup: {
          from: "pharmacystocks", // Collection name for PharmacyStock
          localField: "items.item",
          foreignField: "_id",
          as: "pharmacyStock",
        },
      },
      { $unwind: { path: "$pharmacyStock", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "drugitems", // Collection name for DrugItem
          localField: "pharmacyStock.item",
          foreignField: "_id",
          as: "drugItem",
        },
      },
      { $unwind: { path: "$drugItem", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "drugcategories", // Collection name for DrugCategory
          localField: "drugItem.category",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "druglocations", // Collection name for DrugLocation
          localField: "items.transferFrom.location",
          foreignField: "_id",
          as: "location",
        },
      },
      { $unwind: { path: "$location", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          centre: { $concat: ["$clinicId", "$branchId"] },
          pharmacyDrugName: "$drugItem.name",
          pharmacyDrugCode: "$drugItem.code",
          locationName: "$location.location",
          locationCode: { $ifNull: ["$location._id", "N/A"] },
          category: { $ifNull: ["$category.name", "N/A"] },
          categoryCode: { $ifNull: ["$category._id", "N/A"] },
          quantity: "$items.batches.deductedQuantity",
          unitCost: "$pharmacyStock.sellPrice",
          totalCost: {
            $multiply: ["$items.batches.deductedQuantity", "$pharmacyStock.sellPrice"],
          },
          tax: 0, // Assuming tax is 0 for now
          totalTax: 0, // Assuming total tax is 0 for now
          allocDate: "$date",
          addedBy: "$createdBy",
          remarks: { $ifNull: ["$items.notes", "N/A"] },
        },
      },
      {
        $project: {
          serialNumber: 1,
          centre: 1,
          pharmacyDrugName: 1,
          pharmacyDrugCode: 1,
          locationName: 1,
          locationCode: 1,
          category: 1,
          categoryCode: 1,
          quantity: 1,
          unitCost: 1,
          totalCost: 1,
          tax: 1,
          totalTax: 1,
          allocDate: 1,
          addedBy: 1,
          remarks: 1,
        },
      },
      { $sort: { allocDate: -1 } },
      { $skip: skip },
      { $limit: pageSize },
    ];

    // Log the aggregation pipeline for debugging
    console.log("Aggregation Pipeline: ", JSON.stringify(aggregationPipeline, null, 2));

    // Fetch aggregated internal consumption data
    const internalConsumptionReport = await InternalConsumption.aggregate(aggregationPipeline);

    // Log the report data for debugging
    console.log("Internal Consumption Report Data: ", internalConsumptionReport);

    // Fetch the total document count for pagination
    const totalDocs = await InternalConsumption.countDocuments(matchCondition); // Apply match condition to count
    const totalPages = Math.ceil(totalDocs / pageSize);

    // Add Serial Numbers to each row
    const reportWithSerial = internalConsumptionReport.map((row, index) => ({
      ...row,
      serialNumber: index + 1 + skip,
    }));

    // Format the final result with pagination information
    const paginatedResult = formatPaginationResult({
      docs: reportWithSerial,
      totalDocs,
      totalPages,
      currentPage: parseInt(page, 10),
    });

    // Log the final result for debugging
    console.log("Final Internal Consumption Report with Pagination: ", paginatedResult);

    return successResponse("Internal Consumption Report fetched successfully", paginatedResult);
  } catch (error) {
    // Log the error details for debugging
    console.error("Error in internalConsumptionReport API: ", error);
    return errorResponse(error);
  }
};
