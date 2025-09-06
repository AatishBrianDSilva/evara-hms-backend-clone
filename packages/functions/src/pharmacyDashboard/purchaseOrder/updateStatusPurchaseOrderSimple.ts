import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import {
  EPurchaseOrderStatus,
  PurchaseOrder,
} from '@evara-backend/core/src/models/pharmacyDashboard/PurchaseOrder';

// Simple handler - status comes from URL, no request body needed
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb();

    // Extract ID and status from path parameters
    if (
      !event.pathParameters ||
      !event.pathParameters.id ||
      !event.pathParameters.status
    ) {
      throw new ErrorMessage(400, 'ID and status are required');
    }

    const id = event.pathParameters.id;
    const status = event.pathParameters.status;

    console.log(`🔄 Simple status update: ${id} -> ${status}`);

    if (!Object.values(EPurchaseOrderStatus).includes(status as any)) {
      throw new ErrorMessage(400, `Invalid status: ${status}`);
    }

    const owner = 'Admin';
    const updateData = {
      status,
      authorizedBy: owner,
    };

    const updatedData = await PurchaseOrder.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true },
    );

    if (!updatedData) {
      throw new ErrorMessage(404, 'Purchase order not found');
    }

    console.log(
      '🎉 Simple Purchase Order Status Update SUCCESS - No CORS Issues!',
    );
    return successResponse('Status updated successfully', {
      ...updatedData,
      _debug: {
        simpleApproach: true,
        noCorsIssues: true,
        deployTime: new Date().toISOString(),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
};
