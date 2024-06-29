import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import Patient from "@evara-backend/core/models/Patients";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import formatPaginationResult from "@evara-backend/core/src/lib/utils/formatPaginationResult";

import { IPaginateOptions } from "@evara-backend/core/src/lib/types/pagination";
import { extractAuthorizerDetails } from "@evara-backend/core/lib/utils/extractAuthorizerDetails";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const auth = extractAuthorizerDetails(event);

  try {
    // Connect to MongoDB
    await connectMongoDb();

    // Extract query string parameters
    const params = event.queryStringParameters || {};
    const {
      startDate,
      endDate,
      page = "1",
      limit = "10",
      searchQuery = "",
    } = params;

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

    // Add search conditions
    if (searchQuery) {
      query.$or = [
        { patientId: new RegExp(searchQuery, "i") },
        { firstName: new RegExp(searchQuery, "i") },
        { lastName: new RegExp(searchQuery, "i") },
        { mobile: new RegExp(searchQuery, "i") },
      ];
    }

    const paginate = JSON.parse(params.paginate || "false");

    if (paginate) {
      // Pagination options
      const options: IPaginateOptions = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        lean: true,
      };

      // console.log("Query: ", query);
      // console.log("Options: ", options);
      // Fetching the patients with pagination
      const result = await Patient.paginate(query, options);

      const { records, pagination } = formatPaginationResult(result);

      // console.log("Records: ", records);
      // console.log("Pagination: ", pagination);

      // Return success response with pagination info
      return successResponse("Patients fetched successfully", {
        records,
        pagination,
      });
    } else {
      const data = await Patient.find(query).lean();

      return successResponse("Success", { records: data });
    }
  } catch (error) {
    return errorResponse(error);
  }
};
