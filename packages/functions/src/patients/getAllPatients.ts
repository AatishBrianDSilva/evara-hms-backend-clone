import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import Patient from '@evara-backend/core/models/Patients';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;
  const auth = extractAuthorizerDetails(event);

  try {
    // 1) Connect to MongoDB
    await connectMongoDb();

    // 2) Extract query parameters
    const params = event.queryStringParameters || {};
    const { searchQuery = '', sort } = params;

    // Parse sorting parameters (default: sort by createdAt descending)
    const sortBy = sort ? JSON.parse(sort) : { createdAt: -1 };

    // 3) Build the match object for filtering patients
    const matchStage: Record<string, any> = {
      clinicId: auth.clinicId,
      branchId: auth.branchId,
    };

    // 4) Optional search filter
    if (searchQuery) {
      matchStage.$or = [
        { patientId: new RegExp(searchQuery, 'i') },
        { firstName: new RegExp(searchQuery, 'i') },
        { lastName: new RegExp(searchQuery, 'i') },
        { mobile: new RegExp(searchQuery, 'i') },
      ];
    }

    // 5) Fetch all patients (No pagination)
    const patients = await Patient.find(matchStage).sort(sortBy).exec();

    // 6) Return all patient data
    return successResponse('All patients fetched successfully', {
      records: patients,
    });
  } catch (error) {
    return errorResponse(error);
  }
};
