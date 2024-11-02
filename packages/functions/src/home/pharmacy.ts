import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import { extractAuthorizerDetails } from '@evara-backend/core/src/lib/utils/extractAuthorizerDetails';
import { APIGatewayProxyHandler } from 'aws-lambda';
import { IDateRange } from './summary';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import Patient from '@evara-backend/core/src/models/Patients';
import Donor from '@evara-backend/core/src/models/mastersDashboard/local/Donor';
import { PurchaseOrder } from '@evara-backend/core/src/models/pharmacyDashboard/PurchaseOrder';
import { PharmacyStock } from '@evara-backend/core/src/models/pharmacyDashboard/PharmacyStock';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, 'Unauthorized');
    }
    // Connect to MongoDB
    await connectMongoDb();

    // Extract query string parameters
    const params = event.queryStringParameters || {};
    const { startDate, endDate } = params;
    // console.log("New Params", params);

    const dateRange: IDateRange = {
      startDate: new Date(),
      endDate: new Date(),
    };

    if (startDate) {
      dateRange.startDate = new Date(startDate);
    }
    if (endDate) {
      dateRange.endDate = new Date(endDate);
    }

    const data = await PurchaseOrder.aggregate([
      {
        $match: {
          clinicId: auth.clinicId,
          branchId: auth.branchId,
          date: {
            $gte: dateRange.startDate,
            $lte: dateRange.endDate,
          },
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalNetAmount: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'Processed'] },
                '$response.netAmount',
                0,
              ],
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          totalPurchaseOrders: { $sum: '$count' },
          statuses: {
            $push: {
              status: '$_id',
              count: '$count',
              processedAmount: {
                $cond: [{ $eq: ['$_id', 'Processed'] }, '$totalNetAmount', 0],
              },
            },
          },
          totalProcessedAmount: { $sum: '$totalNetAmount' },
        },
      },
      {
        $project: {
          _id: 0,
          totalPurchaseOrders: 1,
          statuses: 1,
          totalProcessedAmount: 1,
        },
      },
    ]);

    // console.log(JSON.stringify(data, null, 2));

    const purchaseOrders = {
      count: data.length > 0 ? data[0].totalPurchaseOrders : 0,
      totalPayout: data.length > 0 ? data[0].totalProcessedAmount : 0,
    };

    const criticalStocks = await PharmacyStock.aggregate([
      {
        $unwind: '$batches',
      },
      {
        $unwind: '$batches.locations',
      },
      {
        $group: {
          _id: {
            branchId: '$branchId',
            item: '$item',
          },
          totalQuantity: { $sum: '$batches.locations.quantity' },
        },
      },
      {
        $match: {
          totalQuantity: { $lt: 25 },
        },
      },
      {
        $group: {
          _id: '$_id.branchId',
          criticalStockCount: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          branchId: '$_id',
          criticalStockCount: 1,
        },
      },
    ]);

    // console.log("Critical Stocks Count", criticalStocks);

    const response = {
      purchaseOrders,
      criticalStock: {
        count: criticalStocks[0].criticalStockCount,
      },
    };

    return successResponse('Success', response);
  } catch (error) {
    return errorResponse(error);
  }
};
