import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import { IPaginateOptions } from "@evara-backend/core/src/lib/types/pagination";
import formatPaginationResult from "@evara-backend/core/src/lib/utils/formatPaginationResult";
import Doctors from "@evara-backend/core/src/models/mastersDashboard/Doctors";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();

    // const decodedJWT = decodeJWT(event.headers.Authorization); // Assume this function exists
    // const userRole = decodedJWT.role; // User role extracted from JWT
    // const ClinicId = decodedJWT.clinicId; // Clinic ID from JWT
    // let BranchId = decodedJWT.branchId; // Default branch ID from JWT

    const clinicId = "EV";
    let queryBranchId = "KL";

    const params = event.queryStringParameters || {};
    console.log("Params", params);
    const {
      startDate,
      endDate,
      page = "1",
      limit = "10",
      paginate = "false",
      branchId,
    } = params;

    // Override branchId for admins if specified in the query params
    // if (userRole === 'admin' && branchId) {
    //     queryBranchId = branchId;
    // }

    let query: any = { clinicId: clinicId };

    // Add branchId to query if provided and if paginate is "false"
    if (queryBranchId && paginate === "false") {
      query.branchId = queryBranchId;
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

    // await new Promise((resolve) => setTimeout(resolve, 10000));

    // Fetching the doctors with or without pagination
    if (paginate === "true") {
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
