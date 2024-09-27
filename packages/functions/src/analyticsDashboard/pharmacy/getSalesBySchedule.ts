import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { PatientPharmacy } from "@evara-backend/core/src/models/patientDashboard/PatientPharmacy";
import formatPaginationResult from "@evara-backend/core/src/lib/utils/formatPaginationResult";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb();

    console.log("Backend Received Query Params:", event.queryStringParameters);

    // Extract query string parameters for pagination and filtering
    const params = event.queryStringParameters || {};
    const { page = "1", limit = "25", paginate = "true", saleDate } = params;

    // Check if pagination is enabled based on the "paginate" parameter
    const isPaginationEnabled = paginate === "true";

    // Calculate skip value for pagination
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    // Build match condition for saleDate filtering
    const matchCondition: any = {};
    if (saleDate) {
      const startOfDay = new Date(saleDate);
      startOfDay.setHours(0, 0, 0, 0); // Start of the day
      const endOfDay = new Date(saleDate);
      endOfDay.setHours(23, 59, 59, 999); // End of the day

      matchCondition.date = {
        $gte: startOfDay,
        $lte: endOfDay,
      };
    }

    // Base Aggregation Pipeline
    const baseAggregationPipeline = [
      {
        $match: matchCondition, // Apply date filter if provided
      },
      {
        $unwind: "$item.details",
      },
      {
        $lookup: {
          from: "doctors", // Collection name for Doctors
          localField: "doctor",
          foreignField: "_id",
          as: "doctorDetails",
        },
      },
      {
        $unwind: { path: "$doctorDetails", preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: "drugitems", // Collection name for DrugItem
          localField: "item.details.itemId",
          foreignField: "_id",
          as: "drugItemDetails",
        },
      },
      {
        $unwind: { path: "$drugItemDetails", preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: "drugcategories", // Collection name for DrugCategory
          localField: "drugItemDetails.category",
          foreignField: "_id",
          as: "drugCategory",
        },
      },
      {
        $unwind: { path: "$drugCategory", preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: "drugtypes", // Collection name for DrugType
          localField: "drugItemDetails.type",
          foreignField: "_id",
          as: "drugType",
        },
      },
      {
        $unwind: { path: "$drugType", preserveNullAndEmptyArrays: true },
      },
      // Lookup to get patient details from the "patients" collection
      {
        $lookup: {
          from: "patients", // Collection name for Patient
          localField: "patient", // Field in PatientPharmacy that maps to patientCode
          foreignField: "patientId", // Field in Patient that corresponds to patientCode
          as: "patientDetails", // Alias for joined data
        },
      },
      {
        $unwind: { path: "$patientDetails", preserveNullAndEmptyArrays: true }, // Unwind the result to get single document
      },
      {
        $addFields: {
          saleDate: "$date",
          hospital: "", // Placeholder for hospital data
          doctorName: {
            $cond: {
              if: { $and: ["$doctorDetails.firstName", "$doctorDetails.lastName"] },
              then: {
                $concat: ["Dr. ", "$doctorDetails.firstName", " ", "$doctorDetails.lastName"],
              },
              else: "N/A",
            },
          },
          patientName: {
            $cond: {
              if: { $and: ["$patientDetails.firstName", "$patientDetails.lastName"] },
              then: { $concat: ["$patientDetails.firstName", " ", "$patientDetails.lastName"] },
              else: "$patientDetails.firstName",
            },
          },
          pharmacyDrug: { $ifNull: ["$drugItemDetails.name", "N/A"] },
          drugCategory: { $ifNull: ["$drugCategory.name", "N/A"] },
          drugType: { $ifNull: ["$drugType.name", "N/A"] },
          batchNum: { $ifNull: ["$item.details.batchNumber", "N/A"] },
          expiryDate: { $ifNull: ["$item.details.expiryDate", "N/A"] },
          quantity: "$item.details.quantity",
          billAmount: { $multiply: ["$item.details.mrp", "$item.details.quantity"] },
        },
      },
      {
        $project: {
          _id: 0,
          saleDate: 1,
          hospital: 1,
          doctorName: 1,
          patientName: 1,
          pharmacyDrug: 1,
          drugCategory: 1,
          drugType: 1,
          batchNum: 1,
          expiryDate: 1,
          quantity: 1,
          billAmount: 1,
        },
      },
      {
        $sort: { saleDate: -1 }, // Sort by saleDate in descending order
      },
    ];

    // Execute aggregation pipeline without skip and limit for totalDocs calculation
    const totalDocsPipeline = [...baseAggregationPipeline];
    const totalDocs = (await PatientPharmacy.aggregate(totalDocsPipeline)).length;

    // Apply skip and limit only if pagination is enabled
    if (isPaginationEnabled) {
      baseAggregationPipeline.push({ $skip: skip }, { $limit: parseInt(limit, 10) });
    }

    // Execute aggregation pipeline
    const salesReport = await PatientPharmacy.aggregate(baseAggregationPipeline);

    // Add Serial Numbers to each row
    const salesReportWithSerial = salesReport.map((row, index) => ({
      ...row,
      serialNumber: index + 1 + (isPaginationEnabled ? skip : 0), // Adjust for pagination if enabled
    }));

    // Calculate totalPages based on actual totalDocs and limit
    const totalPages = isPaginationEnabled ? Math.ceil(totalDocs / parseInt(limit, 10)) : 1;

    // Format the final result with pagination information
    const paginatedResult = formatPaginationResult({
      docs: salesReportWithSerial,
      totalDocs,
      totalPages,
      currentPage: parseInt(page, 10),
    });

    return successResponse("Sales by Schedule fetched successfully", paginatedResult);
  } catch (error) {
    console.error("Error in salesBySchedule API: ", error);
    return errorResponse(error);
  }
};
