import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import Patient from "@evara-backend/core/models/Patients";
import successResponse from "@evara-backend/core/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import formatPaginationResult from "@evara-backend/core/lib/utils/formatPaginationResult";

import { IPaginateOptions } from "@evara-backend/core/lib/types/pagination";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    // Connect to MongoDB
    await connectMongoDb();

    // Extract query string parameters
    const params = event.queryStringParameters || {};
    const { startDate, endDate, page = "1", limit = "10", ...filters } = params;

    // Construct the query object
    let query: any = {};

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Apply additional filters dynamically
    Object.keys(filters).forEach((key) => {
      query[key] = filters[key];
    });

    // Pagination options
    const options: IPaginateOptions = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      lean: true,
    };

    // Fetching the patients with pagination
    const result = await Patient.paginate(query, options);

    const { records, pagination } = formatPaginationResult(result);

    // Return success response with pagination info
    return successResponse("Patients fetched successfully", {
      records,
      pagination,
    });
  } catch (error) {
    return errorResponse(error);
  }
};
