import { APIGatewayProxyHandler } from 'aws-lambda';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import MasterCryoPreservation from '@evara-backend/core/src/models/patientDashboard/cryoPreservation/MasterCryoPreservations';
import CryoPreservations from '@evara-backend/core/src/models/patientDashboard/cryoPreservation/CryoPreservations';

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

    //Get all cryoPreservations
    const cryoPreservations = await MasterCryoPreservation.findById(id)
      .populate({
        path: 'cryoPreservation',
        model: CryoPreservations.modelName,
      })
      .lean();

    // Return success response
    return successResponse('Success', cryoPreservations);
  } catch (error) {
    return errorResponse(error);
  }
};
