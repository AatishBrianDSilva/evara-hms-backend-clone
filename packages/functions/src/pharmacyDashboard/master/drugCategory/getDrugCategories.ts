import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { DrugCategory } from "@evara-backend/core/models/pharmacyDashboard/DrugCategory";
import { IPaginateOptions } from "@evara-backend/core/src/lib/types/pagination";
import formatPaginationResult from "@evara-backend/core/src/lib/utils/formatPaginationResult";
import { extractAuthorizerDetails } from "@evara-backend/core/lib/utils/extractAuthorizerDetails";
import ErrorMessage from "@evara-backend/core/lib/utils/ErrorMessage";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const auth = extractAuthorizerDetails(event);

  try {
    if (auth.clinicId == null) {
      throw new ErrorMessage(400, "Clinic ID is required");
    }
    await connectMongoDb();

    const params = event.queryStringParameters || {};
    const {
      page = "1",
      limit = "10",
      sort: sortRaw,
      searchQuery = "",
      status = "", // Add status to query parameters
    } = params;

    const sort = sortRaw ? JSON.parse(sortRaw) : undefined;

    const paginate = JSON.parse(params.paginate || "false");

    if (paginate) {
      const options: IPaginateOptions = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        lean: true,
      };

      const query: any = {};
      query.clinicId = auth.clinicId;

      if (searchQuery) {
        query.$or = [{ name: new RegExp(searchQuery, "i") }];
      }

      if (status === "Active") {
        query.status = { $nin: ["Inactive"] }; // Exclude "Inactive" records
      }

      if (sort) {
        options.sort = sort;
      }

      // Fetching the appointments with pagination
      const result = await DrugCategory.paginate(query, options);
      const { records, pagination } = formatPaginationResult(result);

      return successResponse("Success", {
        records,
        pagination,
      });
    } else {
      const query: any = {
        clinicId: auth.clinicId,
      };

      // Search query
      if (searchQuery) {
        query.$or = [{ name: new RegExp(searchQuery, "i") }];
      }

      // Apply status filter if "Active" is sent
      if (status === "Active") {
        query.status = { $nin: ["Inactive"] }; // Exclude "Inactive" records
      }

      // Fetching data without pagination
      const data = await DrugCategory.find(query).sort(sort).lean();

      return successResponse("Success", { records: data, pagination: {} });
    }
  } catch (error) {
    return errorResponse(error);
  }
};
