import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import { IPaginateOptions } from "@evara-backend/core/src/lib/types/pagination";
import formatPaginationResult from "@evara-backend/core/src/lib/utils/formatPaginationResult";
import Doctors from "@evara-backend/core/src/models/mastersDashboard/Doctors";
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, "Unauthorized");
    }

    await connectMongoDb();

    const params = event.queryStringParameters || {};
    console.log("Params", params);
    const { startDate, endDate, page = "1", limit = "10" } = params;

    const isGlobal = JSON.parse(params.isGlobal || "false");
    const isAdmin = JSON.parse(params.isAdmin || "false");
    const status = params.status || "active";

    let query: any = { clinicId: auth.clinicId };

    if (!isAdmin) {
      query.status = status;
    }

    if (!isGlobal) {
      query.branchId = auth.branchId;
    }

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

    const paginate = JSON.parse(params.paginate || "false");

    // Fetching the doctors with or without pagination
    if (paginate) {
      // Pagination options
      const options: IPaginateOptions = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        lean: true,
      };

      // Fetching the doctors with pagination
      const result = await Doctors.paginate(query, options);
      const { records, pagination } = formatPaginationResult(result);

      // Return success response with pagination info
      return successResponse("Doctors fetched successfully", {
        records,
        pagination,
      });
    } else {
      // Fetching all doctors without pagination
      console.log("Query", query);
      const doctors = await Doctors.find(query).lean();

      // Return success response without pagination info
      return successResponse("Doctors fetched successfully", {
        records: doctors,
      });
    }
  } catch (error) {
    return errorResponse(error);
  }
};
