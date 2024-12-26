import { APIGatewayProxyHandler } from 'aws-lambda';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { IPaginateOptions } from '@evara-backend/core/src/lib/types/pagination';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import Doctors from '@evara-backend/core/src/models/mastersDashboard/Doctors';
import formatPaginationResult from '@evara-backend/core/src/lib/utils/formatPaginationResult';
import mongoose from 'mongoose';
import PatientInvestigation from '@evara-backend/core/src/models/patientDashboard/investigation/PatientInvestigation';
import MasterInvestigation from '@evara-backend/core/src/models/patientDashboard/investigation/MasterInvestigations';
import MedicalTest from '@evara-backend/core/src/models/patientDashboard/investigation/MedicalTests';
import Patient from '@evara-backend/core/src/models/Patients';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const auth = extractAuthorizerDetails(event);

  try {
    // Connect to MongoDB
    await connectMongoDb();

    // Extract query string parameters
    const params = event.queryStringParameters || {};
    // console.log("Params", params);
    const {
      startDate,
      endDate,
      page = '1',
      limit = '10',
      sort: sortRaw,
      ...filters
    } = params;

    const sort = sortRaw ? JSON.parse(sortRaw) : { date: -1 };

    // Construct the query object
    let query: any = {
      clinicId: auth.clinicId,
      branchId: auth.branchId,
    };

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
      sort,
    };

    //Add populate fields
    options.populate = [
      {
        path: 'doctor',
        select: 'firstName lastName desgination',
        model: Doctors.modelName,
      },
      {
        path: 'investigation',
        model: MasterInvestigation.modelName,
        populate: {
          path: 'test',
          model: MedicalTest.modelName,
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
      throw new ErrorMessage(404, 'Patient not found');
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

    // Filtering by specific investigation ID
    if (filters.investigationId) {
      query._id = new mongoose.Types.ObjectId(filters.investigationId);
    }

    const paginate = JSON.parse(params.paginate || 'false');

    if (paginate) {
      // Fetching the appointments with pagination
      const result = await PatientInvestigation.paginate(query, options);
      const { records, pagination } = formatPaginationResult(result);

      return successResponse('Success', {
        records,
        pagination,
      });
    } else {
      // Fetching the appointments without pagination
      const records = await PatientInvestigation.find(query).lean();

      return successResponse('Success', { records: records, pagination: {} });
    }
  } catch (error) {
    return errorResponse(error);
  }
};
