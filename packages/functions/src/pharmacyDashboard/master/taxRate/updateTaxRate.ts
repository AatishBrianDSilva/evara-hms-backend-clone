import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { TaxRate } from '@evara-backend/core/models/pharmacyDashboard/TaxRate';

// Handler function for updating a single tax rate
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb(); // Connect to MongoDB

    if (!event.body) {
      throw new ErrorMessage(400, 'Data is required');
    }

    // Assuming the event body will contain the ID of the tax rate to be updated and the new values
    const { id, ...updateData } = JSON.parse(event.body);

    if (!id) {
      throw new ErrorMessage(400, 'Tax rate ID is required for update');
    }

    // Find by ID and update the tax rate
    const updatedTaxRate = await TaxRate.findByIdAndUpdate(id, updateData, {
      new: true, // Return the updated document
    });

    if (!updatedTaxRate) {
      throw new ErrorMessage(404, 'Tax rate not found');
    }

    return successResponse('Tax rate updated successfully', updatedTaxRate);
  } catch (error) {
    return errorResponse(error);
  }
};
