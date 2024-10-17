import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { IPaginateOptions } from "@evara-backend/core/src/lib/types/pagination";
import formatPaginationResult from "@evara-backend/core/src/lib/utils/formatPaginationResult";
import { DrugType } from "@evara-backend/core/src/models/pharmacyDashboard/DrugType";
import { extractAuthorizerDetails } from "@evara-backend/core/lib/utils/extractAuthorizerDetails";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;
  const auth = extractAuthorizerDetails(event);

  try {
    await connectMongoDb();

    const params = event.queryStringParameters || {};
    const { page = "1", limit = "10", sort: sortRaw, searchQuery = "", status = "" } = params;

    const sort = sortRaw ? JSON.parse(sortRaw) : undefined;
    const paginate = JSON.parse(params.paginate || "false");

    if (paginate) {
      const options: IPaginateOptions = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        lean: true,
      };

      const query: any = {
        clinicId: auth.clinicId,
      };

      if (sort) {
        options.sort = sort;
      }

      if (searchQuery) {
        query.$or = [{ name: new RegExp(searchQuery, "i") }];
      }

      if (status === "Active") {
        query.status = { $nin: ["Inactive"] }; // Exclude "Inactive" records
      }

      // Fetching the appointments with pagination
      const result = await DrugType.paginate(query, options);
      const { records, pagination } = formatPaginationResult(result);

      return successResponse("Success", {
        records,
        pagination,
      });
    } else {
      const query: any = {
        clinicId: auth.clinicId,
      };

      if (searchQuery) {
        query.$or = [{ name: new RegExp(searchQuery, "i") }];
      }

      if (status === "Active") {
        query.status = { $nin: ["Inactive"] }; // Exclude "Inactive" records
      }

      const data = await DrugType.find(query).sort(sort).lean();

      return successResponse("Success", { records: data, pagination: {} });
    }
  } catch (error) {
    return errorResponse(error);
  }
};
