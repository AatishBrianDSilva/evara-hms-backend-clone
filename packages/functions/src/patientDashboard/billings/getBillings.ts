import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import formatPaginationResult from "@evara-backend/core/src/lib/utils/formatPaginationResult";
import { IPaginateOptions } from "@evara-backend/core/src/lib/types/pagination";
import { log } from "console";
import Doctors from "@evara-backend/core/src/models/mastersDashboard/Doctors";
import { PatientBilling } from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();

    const params = event.queryStringParameters || {};
    const { page = "1", limit = "10", sort: sortRaw, status } = params;

    const sort = sortRaw ? JSON.parse(sortRaw) : undefined;

    const populate = [
      {
        path: "items.doctorId",
        model: Doctors.modelName,
      },
    ];

    const paginate = JSON.parse(params.paginate || "false");

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
      const result = await PatientBilling.paginate(query, options);
      const { records, pagination } = formatPaginationResult(result);

      return successResponse("Success", {
        records,
        pagination,
      });
    } else {
      const data = await PatientBilling.find()
        .populate(populate)
        .sort(sort)
        .lean();

      return successResponse("Success", {
        records: data,
      });
    }
  } catch (error) {
    return errorResponse(error);
  }
};
