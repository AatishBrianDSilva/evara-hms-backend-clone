import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { DrugItem } from "@evara-backend/core/src/models/pharmacyDashboard/DrugItem";
import formatPaginationResult from "@evara-backend/core/src/lib/utils/formatPaginationResult";
import { extractAuthorizerDetails } from "@evara-backend/core/lib/utils/extractAuthorizerDetails";
import ErrorMessage from "@evara-backend/core/lib/utils/ErrorMessage";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, "Unauthorized");
    }

    await connectMongoDb();

    // Extract query string parameters for pagination and filtering
    const params = event.queryStringParameters || {};
    const { page = "1", limit = "25", drugName = "" } = params;

    // Calculate skip and limit for pagination
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const pageSize = parseInt(limit, 10);

    // Build match condition for drugName filtering
    const matchCondition: any = {
      branchId: auth.branchId, // Filter by branch
    };

    if (drugName) {
      matchCondition.name = { $regex: new RegExp(drugName, "i") }; // Case-insensitive partial match
    }

    // Aggregation pipeline
    const aggregationPipeline = [
      {
        $match: matchCondition, // Apply drugName filter if provided
      },
      {
        $lookup: {
          from: "drugtypes", // Collection name for DrugType
          localField: "type",
          foreignField: "_id",
          as: "drugType",
        },
      },
      {
        $lookup: {
          from: "drugcategories", // Collection name for DrugCategory
          localField: "category",
          foreignField: "_id",
          as: "drugCategory",
        },
      },
      {
        $lookup: {
          from: "drugmanufacturers", // Collection name for DrugManufacturer
          localField: "manufacturer",
          foreignField: "_id",
          as: "drugManufacturer",
        },
      },
      {
        $lookup: {
          from: "pharmacystocks", // Collection name for PharmacyStock
          localField: "_id",
          foreignField: "item",
          as: "pharmacyStock",
        },
      },
      {
        $addFields: {
          drugCategory: {
            $cond: {
              if: { $eq: [{ $arrayElemAt: ["$drugCategory.name", 0] }, null] },
              then: "N/A",
              else: { $arrayElemAt: ["$drugCategory.name", 0] },
            },
          },
          categoryCode: {
            $cond: {
              if: { $eq: [{ $arrayElemAt: ["$drugCategory._id", 0] }, null] },
              then: "N/A",
              else: { $arrayElemAt: ["$drugCategory._id", 0] },
            },
          },
          drugType: {
            $cond: {
              if: { $eq: [{ $arrayElemAt: ["$drugType.name", 0] }, null] },
              then: "N/A",
              else: { $arrayElemAt: ["$drugType.name", 0] },
            },
          },
          typeCode: {
            $cond: {
              if: { $eq: [{ $arrayElemAt: ["$drugType._id", 0] }, null] },
              then: "N/A",
              else: { $arrayElemAt: ["$drugType._id", 0] },
            },
          },
          drugCompany: {
            $cond: {
              if: { $eq: [{ $arrayElemAt: ["$drugManufacturer.name", 0] }, null] },
              then: "N/A",
              else: { $arrayElemAt: ["$drugManufacturer.name", 0] },
            },
          },
          companyCode: {
            $cond: {
              if: { $eq: [{ $arrayElemAt: ["$drugManufacturer.tin", 0] }, null] },
              then: "N/A",
              else: { $arrayElemAt: ["$drugManufacturer.tin", 0] },
            },
          },
          drugName: {
            $cond: {
              if: { $or: [{ $eq: ["$name", ""] }, { $eq: ["$name", null] }] },
              then: "N/A",
              else: "$name",
            },
          },
          genericName: {
            $cond: {
              if: { $or: [{ $eq: ["$genericName", ""] }, { $eq: ["$genericName", null] }] },
              then: "N/A",
              else: "$genericName",
            },
          },
          drugCode: {
            $cond: {
              if: { $or: [{ $eq: ["$code", ""] }, { $eq: ["$code", null] }] },
              then: "N/A",
              else: "$code",
            },
          },
          hsnCode: {
            $cond: {
              if: { $or: [{ $eq: ["$hsnCode", ""] }, { $eq: ["$hsnCode", null] }] },
              then: "N/A",
              else: "$hsnCode",
            },
          },
          qtyPerPack: { $ifNull: ["$packSize", 0] },
          // Updated units calculation to sum quantities correctly
          units: {
            $ifNull: [
              {
                $sum: {
                  $map: {
                    input: "$pharmacyStock.batches",
                    as: "batch",
                    in: {
                      $sum: {
                        $map: {
                          input: "$$batch.locations",
                          as: "location",
                          in: "$$location.quantity", // Sum quantity at each location
                        },
                      },
                    },
                  },
                },
              },
              0,
            ],
          },
          tax: {
            $cond: {
              if: { $or: [{ $eq: ["$taxRate", ""] }, { $eq: ["$taxRate", null] }] },
              then: "N/A",
              else: "$taxRate",
            },
          },
          updatedAt: { $ifNull: [{ $arrayElemAt: ["$pharmacyStock.updatedAt", 0] }, new Date(0)] }, // Set to epoch date if null
        },
      },
      {
        $project: {
          drugCategory: 1,
          categoryCode: 1,
          drugType: 1,
          typeCode: 1,
          drugCompany: 1,
          companyCode: 1,
          drugName: 1,
          genericName: 1,
          drugCode: 1,
          hsnCode: 1,
          qtyPerPack: 1,
          tax: 1,
          updatedAt: 1, // Ensure updatedAt is included in the final output
        },
      },
      { $sort: { updatedAt: -1 } }, // Sort by pharmacyStock updatedAt in descending order
      { $skip: skip },
      { $limit: pageSize },
    ];

    // Fetch paginated and aggregated drug items
    const drugItems = await DrugItem.aggregate(aggregationPipeline);

    // Fetch the total document count for pagination
    const totalDocs = await DrugItem.countDocuments(matchCondition); // Use matchCondition for count
    const totalPages = Math.ceil(totalDocs / pageSize);

    // Add Serial Numbers to each row
    const drugItemsWithSerial = drugItems.map((row, index) => ({
      ...row,
      serialNumber: index + 1 + skip, // Serial numbers adjusted for pagination
    }));

    // Format the final result with pagination information
    const paginatedResult = formatPaginationResult({
      docs: drugItemsWithSerial,
      totalDocs,
      totalPages,
      currentPage: parseInt(page, 10),
    });

    // Log the final result for debugging
    console.log("Final Drug Vendor Report with Pagination: ", paginatedResult);

    return successResponse("Drug Vendor Report fetched successfully", paginatedResult);
  } catch (error) {
    console.error("Error in Drug Vendor Report API: ", error);
    return errorResponse(error);
  }
};
