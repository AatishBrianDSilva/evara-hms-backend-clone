import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/lib/utils/successResponse";
import formatPaginationResult from "@evara-backend/core/src/lib/utils/formatPaginationResult";
import { IPaginateOptions } from "@evara-backend/core/src/lib/types/pagination";
import { DrugVendor } from "@evara-backend/core/src/models/pharmacyDashboard/DrugVendor";
import { DrugItem } from "@evara-backend/core/src/models/pharmacyDashboard/DrugItem";
import Branch from "@evara-backend/core/src/models/ClinicBranches";
import { log } from "console";
import { PurchaseOrder } from "@evara-backend/core/src/models/pharmacyDashboard/PurchaseOrder";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();

    const params = event.queryStringParameters || {};
    const {
      page = "1",
      limit = "10",
      paginate,
      sort: sortRaw,
      status,
    } = params;

    const sort = sortRaw ? JSON.parse(sortRaw) : undefined;

    const populate = [
      {
        path: "vendor",
        model: DrugVendor.modelName,
      },
      {
        path: "request.items.item",
        model: DrugItem.modelName,
      },
      {
        path: "response.items.item",
        model: DrugItem.modelName,
      },
      {
        path: "branch",
        model: Branch.modelName,
      },
    ];

    if (paginate) {
      const options: IPaginateOptions = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        lean: true,
      };

      const query: any = {};
      query.branchId = "KL";

      if (status) {
        query.status = status;
      }

      if (sort) {
        options.sort = sort;
      }

      options.populate = populate;

      log("Query", query);

      // Fetching the appointments with pagination
      const result = await PurchaseOrder.paginate(query, options);
      const { records, pagination } = formatPaginationResult(result);

      return successResponse("Success", {
        records,
        pagination,
      });
    } else {
      const data = await PurchaseOrder.find()
        .populate(populate)
        .sort(sort)
        .lean();

      return successResponse("Success", data);
    }
  } catch (error) {
    return errorResponse(error);
  }
};
