// src/handlers/getStockValues.ts
import '@evara-backend/core/src/models/pharmacyDashboard/DrugItem';
import '@evara-backend/core/src/models/pharmacyDashboard/DrugLocation';

import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/src/lib/utils/extractAuthorizerDetails';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import { PharmacyStock } from '@evara-backend/core/src/models/pharmacyDashboard/PharmacyStock';

export const main: APIGatewayProxyHandler = async (event, _ctx) => {
  _ctx.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) throw new ErrorMessage(401, 'Unauthorized');
    await connectMongoDb();

    // optional filter: location:<term>
    const { searchQuery = '' } = event.queryStringParameters || {};
    const locationFilter = searchQuery.startsWith('location:')
      ? new RegExp(searchQuery.replace(/^location:/, ''), 'i')
      : null;

    const pipeline: any[] = [
      // 1) restrict to this clinic/branch
      // { $match: { clinicId: auth.clinicId, branchId: auth.branchId } },

      // 2) unwind every batch & its locations
      { $unwind: '$batches' },
      { $unwind: '$batches.locations' },

      // 3) bring in the DrugItem so we can get rate & mrp + packSize
      {
        $lookup: {
          from: 'drugitems',
          localField: 'item',
          foreignField: '_id',
          as: 'itemDetails',
        },
      },
      { $unwind: { path: '$itemDetails', preserveNullAndEmptyArrays: true } },

      // 4) compute per‑unit cost & mrp
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

      // 5) for each location‑row, multiply by quantity to get cost & mrp
      {
        $project: {
          locationId: '$batches.locations.location',
          cost: { $multiply: ['$unitCost', '$batches.locations.quantity'] },
          mrp: { $multiply: ['$unitMrp', '$batches.locations.quantity'] },
        },
      },

      // 6) roll up (group) by locationId
      {
        $group: {
          _id: '$locationId',
          totalCost: { $sum: '$cost' },
          totalMrp: { $sum: '$mrp' },
        },
      },

      // 7) lookup the human‑readable name
      {
        $lookup: {
          from: 'druglocations',
          localField: '_id',
          foreignField: '_id',
          as: 'locDocs',
        },
      },
      {
        $addFields: {
          location: {
            $cond: [
              { $gt: [{ $size: '$locDocs' }, 0] },
              { $arrayElemAt: ['$locDocs.location', 0] },
              'Others',
            ],
          },
        },
      },

      // 8) apply optional name filter
      ...(locationFilter ? [{ $match: { location: locationFilter } }] : []),

      // 9) shape the final fields
      {
        $project: {
          _id: 0,
          locationId: '$_id',
          location: 1,
          totalCost: 1,
          totalMrp: 1,
        },
      },

      // 10) sort by highest cost first
      { $sort: { totalCost: -1 } },
    ];

    const records = await PharmacyStock.aggregate(pipeline);
    return successResponse('Success', { records });
  } catch (err) {
    console.error('Error fetching stock values:', err);
    return errorResponse(err);
  }
};
