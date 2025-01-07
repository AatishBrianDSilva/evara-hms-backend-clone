import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { PharmacyStock } from '@evara-backend/core/models/pharmacyDashboard/PharmacyStock';
import { DrugItem } from '@evara-backend/core/models/pharmacyDashboard/DrugItem';

export const main: APIGatewayProxyHandler = async (_event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    // Connect to MongoDB
    await connectMongoDb();

    // Fetch all stock items with their batch numbers, names, and IDs
    const pharmacyStocks = await PharmacyStock.find(
      {},
      { 'batches.batchNo': 1, item: 1 }, // Select only required fields
    )
      .populate({
        path: 'item',
        model: DrugItem,
        select: 'name',
      })
      .lean();

    // Prepare response
    const response = pharmacyStocks.map(stock => ({
      itemId: stock.item?._id || null,
      itemName: stock.item?.name || 'Unknown Item',
      batchNumbers: stock.batches.map(batch => batch.batchNo),
    }));

    return successResponse(
      'Stocks with batch numbers fetched successfully',
      response,
    );
  } catch (error) {
    console.error('Error fetching stocks with batch numbers:', error);
    return errorResponse(error);
  }
};
