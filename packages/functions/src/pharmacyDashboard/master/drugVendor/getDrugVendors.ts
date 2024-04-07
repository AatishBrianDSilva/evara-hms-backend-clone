import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/lib/utils/successResponse";
import { IPaginateOptions } from "@evara-backend/core/src/lib/types/pagination";
import formatPaginationResult from "@evara-backend/core/src/lib/utils/formatPaginationResult";
import { DrugVendor } from "@evara-backend/core/src/models/pharmacyDashboard/DrugVendor";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();

    const params = event.queryStringParameters || {};
    const { page = "1", limit = "10", paginate, sort: sortRaw } = params;

    const sort = sortRaw ? JSON.parse(sortRaw) : undefined;

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
      const result = await DrugVendor.paginate(query, options);
      const { records, pagination } = formatPaginationResult(result);

      return successResponse("Success", {
        records,
        pagination,
      });
    } else {
      const drugVendors = await DrugVendor.find({ branchId: "KL" })
        .sort(sort)
        .lean();

      return successResponse("Success", drugVendors);
    }
  } catch (error) {
    return errorResponse(error);
  }
};
