import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import ErrorMessage from '@evara-backend/core/lib/utils/ErrorMessage';
import { PharmacyStock } from '@evara-backend/core/src/models/pharmacyDashboard/PharmacyStock';

/**
 * Item-wise stock value (qty × unit cost / MRP), optionally filtered by drug name.
 */
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) throw new ErrorMessage(401, 'Unauthorized');
    await connectMongoDb();

    const params = event.queryStringParameters || {};
    const { page = '1', limit = '25', paginate = 'true', search = '' } = params;

    const isPaginated = paginate === 'true';
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    const pipeline: any[] = [
      { $match: { clinicId: auth.clinicId, branchId: auth.branchId } },
      { $unwind: '$batches' },
      { $unwind: '$batches.locations' },
      {
        $lookup: {
          from: 'drugitems',
          localField: 'item',
          foreignField: '_id',
          as: 'itemDetails',
        },
      },
      { $unwind: { path: '$itemDetails', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          unitCost: {
            $cond: [
              { $gt: ['$itemDetails.packSize', 0] },
              { $divide: ['$itemDetails.rate', '$itemDetails.packSize'] },
              0,
            ],
          },
          unitMrp: {
            $cond: [
              { $gt: ['$itemDetails.packSize', 0] },
              { $divide: ['$itemDetails.mrp', '$itemDetails.packSize'] },
              0,
            ],
          },
        },
      },
      {
        $group: {
          _id: '$item',
          drugName: { $first: '$itemDetails.name' },
          drugCode: { $first: '$itemDetails.code' },
          hsnCode: { $first: '$itemDetails.hsnCode' },
          quantity: { $sum: '$batches.locations.quantity' },
          totalCost: {
            $sum: {
              $multiply: ['$unitCost', '$batches.locations.quantity'],
            },
          },
          totalMrp: {
            $sum: {
              $multiply: ['$unitMrp', '$batches.locations.quantity'],
            },
          },
        },
      },
      {
        $match: {
          $or: [{ totalCost: { $gt: 0 } }, { totalMrp: { $gt: 0 } }],
        },
      },
    ];

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      pipeline.push({
        $match: {
          $or: [{ drugName: searchRegex }, { drugCode: searchRegex }],
        },
      });
    }

    pipeline.push({ $sort: { totalCost: -1 } });

    pipeline.push({
      $facet: {
        records: [
          ...(isPaginated
            ? [
                { $skip: (pageNumber - 1) * limitNumber },
                { $limit: limitNumber },
              ]
            : []),
          {
            $project: {
              _id: 0,
              id: { $toString: '$_id' },
              itemId: { $toString: '$_id' },
              drugName: { $ifNull: ['$drugName', '—'] },
              drugCode: { $ifNull: ['$drugCode', '—'] },
              hsnCode: { $ifNull: ['$hsnCode', '—'] },
              quantity: 1,
              totalCost: 1,
              totalMrp: 1,
            },
          },
        ],
        totalCount: [{ $count: 'count' }],
        summary: [
          {
            $group: {
              _id: null,
              totalQuantity: { $sum: '$quantity' },
              totalCost: { $sum: '$totalCost' },
              totalMrp: { $sum: '$totalMrp' },
              itemCount: { $sum: 1 },
            },
          },
        ],
      },
    });

    const result = await PharmacyStock.aggregate(pipeline);
    const facet = result[0] || {};
    const records = facet.records || [];
    const totalDocs = facet.totalCount?.[0]?.count || 0;
    const summary = facet.summary?.[0] || {
      totalQuantity: 0,
      totalCost: 0,
      totalMrp: 0,
      itemCount: 0,
    };

    return successResponse('Item stock values fetched successfully', {
      records,
      pagination: {
        totalDocs,
        page: pageNumber,
        limit: limitNumber,
      },
      summary: {
        totalQuantity: summary.totalQuantity || 0,
        totalCost: summary.totalCost || 0,
        totalMrp: summary.totalMrp || 0,
        itemCount: summary.itemCount || 0,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
};
