import { APIGatewayProxyHandler } from 'aws-lambda';

import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';

import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/src/lib/utils/extractAuthorizerDetails';
import { deleteAndRestockPharmacy } from 'src/patientDashboard/pharmacy/__deleteAndRestockPharmacy';
import ErrorMessage from '@evara-backend/core/lib/utils/ErrorMessage';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const conn = await connectMongoDb();
  const session = await conn.startSession();
  session.startTransaction();

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, 'Unauthorized');
    }

    if (event.pathParameters === null) {
      throw new ErrorMessage(400, 'Path parameters are null');
    }

    // Safely access the id property
    const id = event.pathParameters['id'];
    if (!id) {
      throw new ErrorMessage(400, 'Id is not provided');
    }

    await deleteAndRestockPharmacy(id, session);
    await session.commitTransaction();
    return successResponse('Deleted successfully');
  } catch (error) {
    await session.abortTransaction();
    return errorResponse(error);
  } finally {
    await session.endSession();
  }
};
