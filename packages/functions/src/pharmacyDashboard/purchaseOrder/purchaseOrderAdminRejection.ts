import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import {
  EPurchaseOrderStatus,
  PurchaseOrder,
} from '@evara-backend/core/src/models/pharmacyDashboard/PurchaseOrder';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;
  const conn = await connectMongoDb();
  const session = await conn.startSession();
  session.startTransaction();

  try {
    const { id } = event.pathParameters || {}; // Extract `id` from pathParameters
    const { isPartial } = JSON.parse(event.body || '{}'); // Extract `isPartial` from request body

    if (!id) {
      throw new ErrorMessage(400, 'ID is required');
    }

    // Fetch the existing purchase order
    const purchaseOrder = await PurchaseOrder.findById(id);
    if (!purchaseOrder) {
      throw new ErrorMessage(404, 'Purchase Order not found');
    }

    // Update the status based on `isPartial` flag
    purchaseOrder.status = isPartial
      ? EPurchaseOrderStatus.PartialPORejectedByAdmin
      : EPurchaseOrderStatus.RejectedByAdmin;

    const updatedPurchaseOrder = await purchaseOrder.save();

    await session.commitTransaction();

    return successResponse(
      'Purchase Order rejected successfully',
      updatedPurchaseOrder,
    );
  } catch (error) {
    await session.abortTransaction();
    console.error('Error rejecting purchase order:', error);
    return errorResponse(error);
  } finally {
    session.endSession();
  }
};
