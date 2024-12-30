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
    if (!event.body) {
      throw new ErrorMessage(400, 'Payload data is required');
    }

    const data = JSON.parse(event.body);

    const { id, payload } = data;

    if (!payload || !id) {
      throw new ErrorMessage(
        400,
        'ID and payloadForApproval data are required',
      );
    }

    // Fetch the existing purchase order
    const purchaseOrder = await PurchaseOrder.findById(id);
    if (!purchaseOrder) {
      throw new ErrorMessage(404, 'Purchase Order not found');
    }

    // Update the status and payloadForApproval
    purchaseOrder.status = EPurchaseOrderStatus.PartialPOWaitingForApproval;
    purchaseOrder.payloadForApproval = payload;

    const updatedPurchaseOrder = await purchaseOrder.save();

    return successResponse(
      'Partial Purchase Order saved for approval',
      updatedPurchaseOrder,
    );
  } catch (error) {
    console.error('Error saving partial PO for approval:', error);
    return errorResponse(error);
  }
};
