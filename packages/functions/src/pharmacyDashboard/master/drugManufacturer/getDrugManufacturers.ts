import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { DrugManufacturer } from "@evara-backend/core/models/pharmacyDashboard/DrugManufacturer";
import { DrugCategory } from "@evara-backend/core/models/pharmacyDashboard/DrugCategory";
import { TaxRate } from "@evara-backend/core/src/models/pharmacyDashboard/TaxRate";
import { IPaginateOptions } from "@evara-backend/core/src/lib/types/pagination";
import formatPaginationResult from "@evara-backend/core/src/lib/utils/formatPaginationResult";
import { extractAuthorizerDetails } from "@evara-backend/core/lib/utils/extractAuthorizerDetails";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const auth = extractAuthorizerDetails(event);

  try {
    await connectMongoDb();

    const params = event.queryStringParameters || {};
    const {
      page = "1",
      limit = "10",
      sort: sortRaw,
      searchQuery = "",
    } = params;

    const sort = sortRaw ? JSON.parse(sortRaw) : undefined;

    const populate = [
      {
        path: "category",
        model: DrugCategory.modelName,
      },
      {
        path: "taxRate",
        model: TaxRate.modelName,
      },
    ];

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

      options.populate = populate;

      // Fetching the appointments with pagination
      const result = await DrugManufacturer.paginate(query, options);
      const { records, pagination } = formatPaginationResult(result);

      return successResponse("Success", {
        records,
        pagination,
      });
    } else {
      const data = await DrugManufacturer.find({ clinicId: auth.clinicId })
        .populate(populate)
        .sort(sort)
        .lean();

      return successResponse("Success", { records: data, pagination: {} });
    }
  } catch (error) {
    return errorResponse(error);
  }
};
