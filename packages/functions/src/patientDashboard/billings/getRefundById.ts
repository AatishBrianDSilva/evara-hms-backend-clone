import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { PatientRefund } from '@evara-backend/core/src/models/patientDashboard/Billings/PatientRefund';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  console.log('Starting getRefundById function...');

  try {
    const id = event.pathParameters?.id;
    if (!id) {
      throw new ErrorMessage(400, 'Refund ID is required');
    }

    await connectMongoDb();

    const refund = await PatientRefund.findById(id);
    if (!refund) {
      // return errorResponse(new Error("Refund not found"), 404);
      throw new ErrorMessage(404, 'Refund not found');
    }

    return successResponse('Refund retrieved successfully.', refund);
  } catch (error) {
    return errorResponse(error);
  }
};
