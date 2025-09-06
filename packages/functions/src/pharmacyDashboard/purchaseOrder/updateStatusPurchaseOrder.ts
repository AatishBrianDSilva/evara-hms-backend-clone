import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import {
  EPurchaseOrderStatus,
  PurchaseOrder,
} from '@evara-backend/core/src/models/pharmacyDashboard/PurchaseOrder';

// Handler function for updating a single tax rate
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb(); // Connect to MongoDB

    // Extract ID from path parameters
    if (!event.pathParameters || !event.pathParameters.id) {
      throw new ErrorMessage(400, 'ID is required for update');
    }

    const id = event.pathParameters.id;

    if (!event.body) {
      throw new ErrorMessage(400, 'Data is required');
    }

    const owner = 'Admin'; // This should be the user ID of the user making the request

    // Parse the request body to get the status
    const { status } = JSON.parse(event.body);

    if (!status) {
      throw new ErrorMessage(400, 'Status is required for update');
    }

    if (!Object.values(EPurchaseOrderStatus).includes(status)) {
      throw new ErrorMessage(400, 'Invalid status');
    }

    const updateData = {
      status,
      authorizedBy: owner,
    };

    // Find by ID and update the tax rate
    const updatedData = await PurchaseOrder.findByIdAndUpdate(
      id,
      {
        $set: updateData,
      },
      {
        new: true, // Return the updated document
      },
    );

    if (!updatedData) {
      throw new ErrorMessage(404, 'Data not found');
    }

    console.log(
      '🎉 Purchase Order Status Update SUCCESS - CORS & Path Parameter Fix Applied',
    );
    return successResponse('Status updated successfully', {
      ...updatedData,
      _debug: {
        pathParameterFixed: true,
        corsFixed: true,
        deployTime: new Date().toISOString(),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
};
