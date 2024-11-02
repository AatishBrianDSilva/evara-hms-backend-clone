import { APIGatewayProxyHandler } from 'aws-lambda';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import TreatmentAdvices from '@evara-backend/core/src/models/patientDashboard/treatmentAdvice/treatmentAdvice';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb();

    if (!event.pathParameters) {
      throw new ErrorMessage(400, 'Path parameters are null');
    }

    const id = event.pathParameters['id'];
    if (!id) {
      throw new ErrorMessage(400, 'Id is not provided');
    }

    const treatmentAdvice = await TreatmentAdvices.findByIdAndDelete(id);

    if (!treatmentAdvice) {
      throw new ErrorMessage(404, 'Treatment advice not found');
    }

    return successResponse(
      'Treatment advice deleted successfully',
      treatmentAdvice,
    );
  } catch (error) {
    return errorResponse(error);
  }
};
