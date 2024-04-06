import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import errorMessage from "@evara-backend/core/lib/utils/errorMessage";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/lib/utils/successResponse";
import { DrugManufacturer } from "@evara-backend/core/models/pharmacyDashboard/DrugManufacturer";
import { DrugCategory } from "@evara-backend/core/models/pharmacyDashboard/DrugCategory";
import { TaxRate } from "@evara-backend/core/src/models/pharmacyDashboard/TaxRate";
import { IPaginateOptions } from "@evara-backend/core/src/lib/types/pagination";
import formatPaginationResult from "@evara-backend/core/src/lib/utils/formatPaginationResult";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();

    const params = event.queryStringParameters || {};
    const { page = "1", limit = "10", paginate, sort: sortRaw } = params;

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

      options.populate = populate;

      // Fetching the appointments with pagination
      const result = await DrugManufacturer.paginate(query, options);
      const { records, pagination } = formatPaginationResult(result);

      return successResponse("Success", {
        records,
        pagination,
      });
    } else {
      const data = await DrugManufacturer.find()
        .populate(populate)
        .sort(sort)
        .lean();

      return successResponse("Success", data);
    }
  } catch (error) {
    return errorResponse(error);
  }
};
