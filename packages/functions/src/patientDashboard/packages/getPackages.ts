import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { IPaginateOptions } from "@evara-backend/core/src/lib/types/pagination";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import formatPaginationResult from "@evara-backend/core/src/lib/utils/formatPaginationResult";
import mongoose from "mongoose";
import Patient from "@evara-backend/core/src/models/Patients";
import { extractAuthorizerDetails } from "@evara-backend/core/lib/utils/extractAuthorizerDetails";
import PatientPackage from "@evara-backend/core/models/patientDashboard/packages/PatientPackage";
import MasterPackage from "@evara-backend/core/models/patientDashboard/packages/MasterPackage";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;
  const auth = extractAuthorizerDetails(event);

  try {
    // Connect to MongoDB
    await connectMongoDb();

    // Extract query string parameters
    const params = event.queryStringParameters || {};
    const { startDate, endDate, page = "1", limit = "10", ...filters } = params;

    // Construct the query object
    let query: any = {
      clinicId: auth.clinicId,
      branchId: auth.branchId,
    };

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

    // Pagination options
    const options: IPaginateOptions = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      lean: true,
    };

    // Add populate fields
    options.populate = [
      {
        path: "package",
        model: MasterPackage.modelName,
      },
    ];

    if (filters.patientCode) {
      query.patientCode = filters.patientCode;
    }

    const patient = await Patient.findOne({
      patientId: filters.patientCode,
    }).lean();

    if (!patient) {
      throw new ErrorMessage(404, "Patient not found");
    }

    const paginate = JSON.parse(params.paginate || "false");

    if (paginate) {
      // Fetching the patient packages with pagination
      const result = await PatientPackage.paginate(query, options);
      const { records, pagination } = formatPaginationResult(result);

      return successResponse("Success", {
        records,
        pagination,
      });
    } else {
      // Fetching the patient packages without pagination
      const records = await PatientPackage.find(query).lean();

      return successResponse("Success", { records, pagination: {} });
    }
  } catch (error) {
    return errorResponse(error);
  }
};
