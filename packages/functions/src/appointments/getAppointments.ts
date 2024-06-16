import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { IPaginateOptions } from "@evara-backend/core/src/lib/types/pagination";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import Doctors from "@evara-backend/core/src/models/mastersDashboard/Doctors";
import Appointments from "@evara-backend/core/src/models/Appointments";
import formatPaginationResult from "@evara-backend/core/src/lib/utils/formatPaginationResult";
import mongoose from "mongoose";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    // Connect to MongoDB
    await connectMongoDb();

    // Extract query string parameters
    const params = event.queryStringParameters || {};
    console.log("Params", params);
    const {
      startDate,
      endDate,
      patientId,
      page = "1",
      limit = "10",
      searchQuery = "",
      sort: sortRaw,
      ...filters
    } = params;

    const sort = sortRaw ? JSON.parse(sortRaw) : undefined;

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

    // Pagination options
    const options: IPaginateOptions = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      lean: true,
    };

    //Add populate fields
    options.populate = {
      path: "doctorId",
      select: "firstName lastName desgination",
      model: Doctors.modelName,
    };

    if (filters.doctorId) {
      query.doctorId = new mongoose.Types.ObjectId(filters.doctorId);
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

    if (searchQuery) {
      query.$or = [
        { fullName: new RegExp(searchQuery, "i") },
        { phone: new RegExp(searchQuery, "i") },
      ];
    }

    if (sort) {
      options.sort = sort;
    }

    if (patientId) {
      query.patientId = new RegExp(patientId, "i"); // Case-insensitive match
    }

    // Fetching the appointments with pagination
    const result = await Appointments.paginate(query, options);
    const { records, pagination } = formatPaginationResult(result);

    return successResponse("Success", {
      records,
      pagination,
    });
  } catch (error) {
    return errorResponse(error);
  }
};
