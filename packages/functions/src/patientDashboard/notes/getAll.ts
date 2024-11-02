import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import { extractAuthorizerDetails } from '@evara-backend/core/src/lib/utils/extractAuthorizerDetails';

import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import PatientNotes from '@evara-backend/core/src/models/patientDashboard/PatientNotes';
import Doctors from '@evara-backend/core/models/mastersDashboard/Doctors';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const authorizer = extractAuthorizerDetails(event);
    if (!authorizer) {
      throw new ErrorMessage(401, 'Unauthorized');
    }

    const patient = event.queryStringParameters?.patient;

    if (!patient) {
      throw new ErrorMessage(400, 'Patient is required');
    }

    await connectMongoDb();

    const data = await PatientNotes.find({ patient: patient })
      .populate({
        path: 'doctor',
        model: Doctors.modelName,
      })
      .sort({
        createdAt: -1,
      });

    return successResponse('Success', data);
  } catch (error) {
    return errorResponse(error);
  }
};
