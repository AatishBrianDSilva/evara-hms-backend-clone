import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import {
  PatientBilling,
  IPatientBilling,
} from '@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling';

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

    if (!event.body) {
      throw new ErrorMessage(400, 'Data is required');
    }

    const payments = JSON.parse(event.body);

    console.log('payments', payments);

    const res = await PatientBilling.findByIdAndUpdate(id, {
      $set: {
        payments: payments,
      },
    });

    console.log('res', res);

    return successResponse('Billing updated successfully');
  } catch (error) {
    console.error('Error updating billing:', error);
    return errorResponse(error);
  }
};
