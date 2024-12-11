import { APIGatewayProxyHandler } from 'aws-lambda';
import mongoose from 'mongoose';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { PharmacyStock } from '@evara-backend/core/models/pharmacyDashboard/PharmacyStock';
import { log } from 'console';

export const main: APIGatewayProxyHandler = async (_event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const conn = await connectMongoDb();
  const session = await conn.startSession();
  session.startTransaction();

  try {
    log('Starting sellPrice migration for all items');

    // Find all PharmacyStock documents with top-level sellPrice
    const stocks = await PharmacyStock.find({
      batches: { $exists: true, $ne: [] },
      sellPrice: { $exists: true },
    }).session(session);

    if (!stocks.length) {
      log('No stocks found for migration');
      return successResponse('No stocks found for migration.');
    }

    for (const stock of stocks) {
      let batchesUpdated = false;

      // Update batches with missing sellPrice
      stock.batches = stock.batches.map(batch => {
        if (!batch.sellPrice) {
          batchesUpdated = true;
          return {
            ...batch,
            sellPrice: stock.sellPrice,
          };
        }
        return batch; // Keep existing sellPrice
      });

      if (batchesUpdated) {
        log(`Updating stock with ID: ${stock._id}`);
        // Remove the top-level sellPrice
        stock.sellPrice = undefined;

        // Save the updated document
        await stock.save({ session });
      } else {
        log(`No batches needed updating for stock with ID: ${stock._id}`);
      }
    }

    await session.commitTransaction();
    session.endSession();

    log('Migration for all items completed successfully');
    return successResponse('Migration for all items completed successfully.');
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Migration failed:', error);
    return errorResponse(error);
  }
};
