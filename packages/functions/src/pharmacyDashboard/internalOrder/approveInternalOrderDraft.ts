import { APIGatewayProxyHandler } from 'aws-lambda';

import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import {
  EInternalOrderStatus,
  InternalOrder,
} from '@evara-backend/core/models/pharmacyDashboard/InternalOrder';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  await connectMongoDb();

  try {
    if (event.pathParameters === null) {
      throw new ErrorMessage(400, 'Path parameters are null');
    }

    // Safely access the id property
    const id = event.pathParameters['id'];
    if (!id) {
      throw new ErrorMessage(400, 'Id is not provided');
    }

    // Fetch the order
    const order = await InternalOrder.findById(id).lean();
    if (!order) {
      throw new ErrorMessage(404, 'Order not found');
    }

    // Update the order status to 'Approved'

    await InternalOrder.findByIdAndUpdate(
      {
        _id: id,
      },
      {
        authorizedBy: 'Admin',
        status: EInternalOrderStatus.Approved,
      },
    );

    return successResponse('Internal Order has been approved');
  } catch (error) {
    console.error('Error approving the internal order:', error);
    return errorResponse(error);
  }
};
