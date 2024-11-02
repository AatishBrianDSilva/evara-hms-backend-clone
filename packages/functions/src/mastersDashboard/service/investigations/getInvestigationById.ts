import { APIGatewayProxyHandler } from 'aws-lambda';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import MasterInvestigation from '@evara-backend/core/src/models/patientDashboard/investigation/MasterInvestigations';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import MedicalTest from '@evara-backend/core/src/models/patientDashboard/investigation/MedicalTests';
import Patient from '@evara-backend/core/src/models/Patients';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    // Connect to MongoDB
    await connectMongoDb();

    if (event.pathParameters === null) {
      throw new ErrorMessage(400, 'Path parameters are null');
    }

    // Safely access the id property
    const id = event.pathParameters['id'];
    if (!id) {
      throw new ErrorMessage(400, 'Id is not provided');
    }

    //Get investigations
    const investigations = await MasterInvestigation.findById(id)
      .populate({
        path: 'test',
        model: MedicalTest.modelName,
      })
      .lean();

    // Return success response
    return successResponse('Success', investigations);
  } catch (error) {
    return errorResponse(error);
  }
};
