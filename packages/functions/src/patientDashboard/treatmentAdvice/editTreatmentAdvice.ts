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

    // ✅ Extract `id` from path parameters instead of request body
    const id = event.pathParameters?.id;
    if (!id) {
      throw new ErrorMessage(400, 'Treatment Advice ID is required');
    }

    if (!event.body) {
      throw new ErrorMessage(400, 'Data is required');
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    // Find existing treatment advice
    const existingTreatmentAdvice = await TreatmentAdvices.findById(id);
    if (!existingTreatmentAdvice) {
      throw new ErrorMessage(404, 'Treatment Advice not found');
    }

    // Update treatment advice fields (excluding `id`)
    Object.assign(existingTreatmentAdvice, data);
    existingTreatmentAdvice.updatedAt = new Date();

    const updatedTreatmentAdvice = await existingTreatmentAdvice.save();

    return successResponse(
      'Treatment advice updated successfully',
      updatedTreatmentAdvice,
    );
  } catch (error) {
    return errorResponse(error);
  }
};
