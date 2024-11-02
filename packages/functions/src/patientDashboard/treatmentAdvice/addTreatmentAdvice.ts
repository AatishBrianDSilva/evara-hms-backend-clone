import { APIGatewayProxyHandler } from 'aws-lambda';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import TreatmentAdvices from '@evara-backend/core/src/models/patientDashboard/treatmentAdvice/treatmentAdvice';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    // Connect to MongoDB
    await connectMongoDb();

    if (!event.body) {
      throw new ErrorMessage(400, 'Data is required');
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    const treatmentAdvice = new TreatmentAdvices(data);
    const newTreatmentAdvice = await treatmentAdvice.save();

    return successResponse(
      'Treatment advice created successfully',
      newTreatmentAdvice,
    );
  } catch (error) {
    return errorResponse(error);
  }
};
