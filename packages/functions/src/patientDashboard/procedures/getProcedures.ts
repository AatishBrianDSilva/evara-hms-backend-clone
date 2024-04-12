import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/errorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { IPaginateOptions } from "@evara-backend/core/src/lib/types/pagination";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import Doctors from "@evara-backend/core/src/models/Doctors";
import formatPaginationResult from "@evara-backend/core/src/lib/utils/formatPaginationResult";
import mongoose from "mongoose";
import Patient from "@evara-backend/core/src/models/Patients";
import MasterProcedure from "@evara-backend/core/src/models/patientDashboard/procedure/MasterProcedure";
import MedicalProcedure from "@evara-backend/core/src/models/patientDashboard/procedure/MedicalProcedure";
import PatientProcedures from "@evara-backend/core/src/models/patientDashboard/procedure/PatientProcedure";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    // Connect to MongoDB
    await connectMongoDb();

    // Extract query string parameters
    const params = event.queryStringParameters || {};
    // console.log("Params", params);
    const { startDate, endDate, page = "1", limit = "10", ...filters } = params;

    // Construct the query object
    let query: any = {};

    // // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Apply additional filters dynamically
    // Object.keys(filters).forEach((key) => {
    //   query[key] = filters[key];
    // });

    // Pagination options
    const options: IPaginateOptions = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      lean: true,
    };

    //Add populate fields
    options.populate = [
      {
        path: "doctor",
        select: "firstName lastName desgination",
        model: Doctors.modelName,
      },
      {
        path: "procedure",
        model: MasterProcedure.modelName,
        populate: {
          path: "procedure",
          model: MedicalProcedure.modelName,
        },
      },
    ];

    if (filters.doctor) {
      query.doctor = new mongoose.Types.ObjectId(filters.doctor);
    }

    if (filters.patientCode) {
      query.patientCode = filters.patientCode;
    }

    const patient = await Patient.findOne({
      patientId: filters.patientCode,
    }).lean();
    if (!patient) {
      throw new ErrorMessage(404, "Patient not found");
    }

    if (filters.date) {
      const selectedDate = new Date(filters.date);

      const startOfDay = new Date(selectedDate.setHours(0, 0, 0, 0));

      // Construct the end of the day (23:59:59)
      const endOfDay = new Date(selectedDate.setHours(23, 59, 59, 999));

      // Update your query to use $gte and $lte with the calculated start and end of the day
      query.date = {
        $gte: startOfDay,
        $lte: endOfDay,
      };
    }

    // console.log("Options", options);
    // console.log("Query", query);

    const paginate = JSON.parse(params.paginate || "false");

    if (paginate) {
      // Fetching the appointments with pagination
      const result = await PatientProcedures.paginate(query, options);
      const { records, pagination } = formatPaginationResult(result);

      return successResponse("Success", {
        records,
        pagination,
      });
    } else {
      // Fetching the appointments without pagination
      const records = await PatientProcedures.find(query).lean();

      return successResponse("Success", { records: records, pagination: {} });
    }
  } catch (error) {
    return errorResponse(error);
  }
};
