import { APIGatewayProxyHandler } from 'aws-lambda';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import Appointments from '@evara-backend/core/src/models/Appointments';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';

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

    const result = await Appointments.findByIdAndDelete(id);

    if (!result) {
      throw new ErrorMessage(404, 'No appointment found with the provided ID');
    }

    return successResponse('Success');
  } catch (error) {
    return errorResponse(error);
  }
};
