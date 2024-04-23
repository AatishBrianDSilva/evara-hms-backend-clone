import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { DrugLocation } from "@evara-backend/core/models/pharmacyDashboard/DrugLocation";
import { IPaginateOptions } from "@evara-backend/core/src/lib/types/pagination";
import formatPaginationResult from "@evara-backend/core/src/lib/utils/formatPaginationResult";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();

    const params = event.queryStringParameters || {};
    const { page = "1", limit = "10", sort: sortRaw } = params;

    const sort = sortRaw ? JSON.parse(sortRaw) : undefined;

    const paginate = JSON.parse(params.paginate || "false");

    if (paginate) {
      const options: IPaginateOptions = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        lean: true,
      };

      const query: any = {};

      if (sort) {
        options.sort = sort;
      }

      //Add branchId to query
      query.branchId = "KL";

      // Fetching the appointments with pagination
      const result = await DrugLocation.paginate(query, options);
      const { records, pagination } = formatPaginationResult(result);

      return successResponse("Success", {
        records,
        pagination,
      });
    } else {
      const drugLocations = await DrugLocation.find({ branchId: "KL" })
        .sort(sort)
        .lean();

      return successResponse("Success", {
        records: drugLocations,
        pagination: {},
      });
    }
  } catch (error) {
    return errorResponse(error);
  }
};
