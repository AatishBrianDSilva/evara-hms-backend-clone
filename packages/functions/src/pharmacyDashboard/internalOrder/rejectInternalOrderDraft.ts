import { APIGatewayProxyHandler } from 'aws-lambda';
import mongoose from 'mongoose';
type ObjectId = mongoose.Types.ObjectId; // Using type alias for clarity
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import {
  EInternalOrderStatus,
  InternalOrder,
} from '@evara-backend/core/models/pharmacyDashboard/InternalOrder';
import { PharmacyStock } from '@evara-backend/core/models/pharmacyDashboard/PharmacyStock';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/src/lib/utils/extractAuthorizerDetails';

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

    const orderId = event.pathParameters['id'];
    if (!orderId) {
      throw new ErrorMessage(400, 'Id is not provided');
    }

    const order = await InternalOrder.findById(orderId).session(session);
    if (!order) {
      throw new ErrorMessage(404, 'Order not found');
    }

    // Ensure the order is in a state that can be rejected
    if (
      ![EInternalOrderStatus.Draft, EInternalOrderStatus.Approved].includes(
        order.status,
      )
    ) {
      throw new ErrorMessage(
        400,
        'Order cannot be rejected in its current state',
      );
    }

    // Revert quantities in the PharmacyStock
    for (const item of order.items) {
      const pharmacyStock = await PharmacyStock.findById(item.item).session(
        session,
      );
      if (!pharmacyStock) {
        continue; // If no stock found, skip to next item
      }

      for (const usedBatch of item.batches) {
        const batch = pharmacyStock.batches.find(
          b => b.batchNo === usedBatch.batchId,
        );
        if (batch) {
          const location = batch.locations.find(loc =>
            (loc.location as unknown as ObjectId).equals(
              item.transferFrom.location as unknown as ObjectId,
            ),
          );
          if (location) {
            location.quantity += usedBatch.deductedQuantity; // Restore the quantity
            pharmacyStock.quantityOnHold -= usedBatch.deductedQuantity; // Adjust the quantity on hold
          }
        }
      }

      await pharmacyStock.save({ session });
    }

    // Set the order status to rejected
    order.status = EInternalOrderStatus.Rejected;
    order.authorizedBy = 'Admin';
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    return successResponse(
      'Internal Order rejected and quantities reverted successfully',
    );
  } catch (error) {
    console.error('Error handling internal order rejection:', error);
    await session.abortTransaction();
    session.endSession();
    return errorResponse(error);
  }
};
