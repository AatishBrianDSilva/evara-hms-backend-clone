import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import formatPaginationResult from "@evara-backend/core/src/lib/utils/formatPaginationResult";
import { extractAuthorizerDetails } from "@evara-backend/core/lib/utils/extractAuthorizerDetails";
import ErrorMessage from "@evara-backend/core/lib/utils/ErrorMessage";
import { PatientBilling } from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const auth = extractAuthorizerDetails(event);

  try {
    await connectMongoDb();

    const params = event.queryStringParameters || {};
    const {
      startDate,
      endDate,
      page = "1",
      limit = "10",
      createdBy,
      paymentMode,
      paginate,
    } = params;

    console.log("params", params);

    const startDateObj = startDate ? new Date(startDate) : null;
    const endDateObj = endDate ? new Date(endDate) : null;

    // Construct the match filter dynamically
    const matchFilter: any = {
      clinicId: auth.clinicId,
      branchId: auth.branchId,
    };

    // Add date range filter if both start and end dates are provided
    if (startDateObj && endDateObj) {
      matchFilter.createdAt = {
        $gte: startDateObj,
        $lte: endDateObj,
      };
    }

    // Add user filter if provided
    if (createdBy) {
      matchFilter.createdBy = createdBy;
    }

    // Add payment mode filter if provided (search within payments array)
    if (paymentMode) {
      matchFilter["payments"] = { $elemMatch: { method: paymentMode } };
    }

    // Convert page and limit to numbers
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    // Define the billing aggregation pipeline
    const pipeline: any[] = [
      {
        $addFields: {
          payments: paymentMode
            ? {
                $filter: {
                  input: "$payments",
                  as: "payment",
                  cond: { $eq: ["$$payment.method", paymentMode] },
                },
              }
            : "$payments",
          createdBy: createdBy ? createdBy : "$createdBy", // Apply createdBy filter
        },
      },
      { $match: matchFilter },
      { $unwind: "$payments" },
      {
        $group: {
          _id: {
            createdBy: "$createdBy",
            paymentMethod: "$payments.method",
          },
          totalAmount: { $sum: "$payments.amount" },
        },
      },
      {
        $lookup: {
          from: "patientrefunds",
          let: {
            createdBy: "$_id.createdBy",
            paymentMethod: "$_id.paymentMethod",
            startDate: startDateObj,
            endDate: endDateObj,
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$createdBy", "$$createdBy"] },
                    { $eq: ["$refundDetails.method", "$$paymentMethod"] },
                    { $gte: ["$refundDetails.refundDate", "$$startDate"] },
                    { $lte: ["$refundDetails.refundDate", "$$endDate"] },
                  ],
                },
              },
            },
            { $unwind: "$refundDetails" },
            {
              $group: {
                _id: null,
                totalRefunded: { $sum: "$refundDetails.refundAmount" },
              },
            },
            {
              $project: {
                _id: 0,
                totalRefunded: 1,
              },
            },
          ],
          as: "refundData",
        },
      },
      {
        $addFields: {
          totalRefunded: {
            $ifNull: [{ $arrayElemAt: ["$refundData.totalRefunded", 0] }, 0],
          },
          id: { $concat: ["$_id.createdBy", "_", "$_id.paymentMethod"] },
        },
      },
      {
        $project: {
          _id: 0,
          id: 1,
          createdBy: "$_id.createdBy",
          paymentMethod: "$_id.paymentMethod",
          totalAmount: 1,
          totalRefunded: 1,
        },
      },
      {
        $facet: {
          paginatedResults: [
            { $sort: { totalAmount: -1 } },
            ...(paginate !== "false"
              ? [{ $skip: (pageNumber - 1) * limitNumber }]
              : []),
            ...(paginate !== "false" ? [{ $limit: limitNumber }] : []),
            // { $skip: (pageNumber - 1) * limitNumber },
            // { $limit: limitNumber },
          ],
          totalCount: [{ $count: "count" }],
        },
      },
    ];

    // Execute aggregation
    const res = await PatientBilling.aggregate(pipeline);

    // Extract results and total count
    const records = res[0]?.paginatedResults || [];
    const totalDocs = res[0]?.totalCount[0]?.count || 0;

    // Return the response
    const paginatedResult = {
      records,
      pagination: {
        totalDocs,
        page: pageNumber,
        limit: limitNumber,
      },
    };

    return successResponse(
      "Revenue breakup fetched successfully",
      paginatedResult
    );
  } catch (error) {
    console.error("Error in stockReport API: ", error);
    return errorResponse(error);
  }
};
