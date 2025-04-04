import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { PharmacyInvoice } from '@evara-backend/core/models/pharmacyDashboard/PharmacyInvoice';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb();

    // Extract pagination params
    const params = event.queryStringParameters || {};
    const page = parseInt(params.page || '1', 10);
    const limit = parseInt(params.limit || '10', 10);
    const sort = params.sort ? JSON.parse(params.sort) : { createdAt: -1 };

    // Common pipeline
    const commonPipeline: any[] = [
      {
        $lookup: {
          from: 'purchaseorders',
          localField: 'purchaseOrderId',
          foreignField: 'poNumber',
          as: 'purchaseOrder',
        },
      },
      {
        $unwind: {
          path: '$purchaseOrder',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'drugvendors',
          localField: 'purchaseOrder.vendor',
          foreignField: '_id',
          as: 'vendor',
        },
      },
      {
        $unwind: {
          path: '$vendor',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          vendorName: '$vendor.name',
          totalAmount: { $sum: '$purchaseOrder.responses.netAmount' },
        },
      },
    ];

    const result = await PharmacyInvoice.aggregate([
      {
        $facet: {
          paginatedResults: [
            ...commonPipeline,
            { $sort: sort },
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                clinicId: 1,
                branchId: 1,
                purchaseOrderId: 1,
                invoice: 1,
                invoiceNumber: 1,
                createdAt: 1,
                updatedAt: 1,
                vendorName: 1,
                totalAmount: 1,
              },
            },
          ],
          totalCount: [...commonPipeline, { $count: 'totalDocs' }],
        },
      },
    ]);

    const records = result[0]?.paginatedResults || [];
    const totalDocs = result[0]?.totalCount[0]?.totalDocs || 0;
    const totalPages = Math.ceil(totalDocs / limit);

    return successResponse('Fetched invoices successfully', {
      records,
      pagination: {
        page,
        limit,
        totalDocs,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return errorResponse(error);
  }
};
