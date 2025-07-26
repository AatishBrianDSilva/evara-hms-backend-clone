import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { InternalConsumption } from '@evara-backend/core/src/models/pharmacyDashboard/InternalConsumption';
import formatPaginationResult from '@evara-backend/core/src/lib/utils/formatPaginationResult';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import ErrorMessage from '@evara-backend/core/lib/utils/ErrorMessage';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;
  try {
    // Auth + DB
    const auth = extractAuthorizerDetails(event);
    if (!auth) throw new ErrorMessage(401, 'Unauthorized');
    await connectMongoDb();

    // Params & pagination
    const params = event.queryStringParameters || {};
    const { page = '1', limit = '25', saleStartDate, saleEndDate } = params;
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    // Date filter
    const matchCondition: any = { branchId: auth.branchId };
    if (saleStartDate || saleEndDate) {
      const start = saleStartDate ? new Date(saleStartDate) : null;
      const end = saleEndDate ? new Date(saleEndDate) : null;
      matchCondition.date = {
        ...(start && { $gte: new Date(start.setHours(0, 0, 0, 0)) }),
        ...(end && { $lte: new Date(end.setHours(23, 59, 59, 999)) }),
      };
    }

    // Aggregation
    const pipeline: any[] = [
      // Base
      { $match: matchCondition },
      { $unwind: '$items' },

      // 1) pharmacyStock lookup
      {
        $lookup: {
          from: 'pharmacystocks',
          localField: 'items.item',
          foreignField: '_id',
          as: 'stock',
        },
      },
      { $unwind: { path: '$stock', preserveNullAndEmptyArrays: true } },

      // 2) drugItem lookup
      {
        $lookup: {
          from: 'drugitems',
          localField: 'stock.item',
          foreignField: '_id',
          as: 'drug',
        },
      },
      { $unwind: { path: '$drug', preserveNullAndEmptyArrays: true } },

      // 3) taxRate lookup
      {
        $lookup: {
          from: 'taxrates',
          let: { tr: '$drug.taxRate' },
          pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$tr'] } } }],
          as: 'taxRateDetails',
        },
      },
      {
        $unwind: { path: '$taxRateDetails', preserveNullAndEmptyArrays: true },
      },

      // 4) (Optional) category & location
      {
        $lookup: {
          from: 'drugcategories',
          localField: 'drug.category',
          foreignField: '_id',
          as: 'cat',
        },
      },
      { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'druglocations',
          localField: 'items.transferFrom.location',
          foreignField: '_id',
          as: 'loc',
        },
      },
      { $unwind: { path: '$loc', preserveNullAndEmptyArrays: true } },

      // Stage 1: raw fields
      {
        $addFields: {
          // meta
          centre: { $concat: ['$clinicId', '-', '$branchId'] },
          pharmacyDrugName: '$drug.name',
          pharmacyDrugCode: '$drug.code',
          category: { $ifNull: ['$cat.name', 'N/A'] },
          categoryCode: { $ifNull: ['$cat._id', 'N/A'] },
          locationName: '$loc.location',
          locationCode: { $ifNull: ['$loc._id', 'N/A'] },

          quantity: '$items.quantity',
          unitPrice: {
            $cond: [
              {
                $and: [
                  { $gt: ['$drug.rate', 0] },
                  { $gt: ['$drug.packSize', 0] },
                ],
              },
              { $divide: ['$drug.rate', '$drug.packSize'] },
              0,
            ],
          },
          unitMrp: {
            $cond: [
              {
                $and: [
                  { $gt: ['$drug.mrp', 0] },
                  { $gt: ['$drug.packSize', 0] },
                ],
              },
              { $divide: ['$drug.mrp', '$drug.packSize'] },
              0,
            ],
          },
          taxRate: { $ifNull: ['$taxRateDetails.taxRate', 0] },
        },
      },

      // Stage 2: cost & sellPrice
      {
        $addFields: {
          cost: { $multiply: ['$unitPrice', '$quantity'] },
          sellPrice: { $multiply: ['$unitMrp', '$quantity'] },
        },
      },

      // Stage 3: totalTax
      {
        $addFields: {
          totalTax: {
            $multiply: ['$cost', { $divide: ['$taxRate', 100] }],
          },
        },
      },

      // filter zero
      { $match: { quantity: { $gt: 0 } } },

      // project
      {
        $project: {
          _id: 0,
          serialNumber: 1,
          centre: 1,
          pharmacyDrugName: 1,
          pharmacyDrugCode: 1,
          category: 1,
          categoryCode: 1,
          locationName: 1,
          locationCode: 1,
          quantity: 1,
          cost: '$cost',
          sellPrice: '$sellPrice',
          taxRate: 1,
          totalTax: '$totalTax',
          allocDate: '$date',
          addedBy: '$createdBy',
          remarks: { $ifNull: ['$items.notes', 'N/A'] },
        },
      },

      // paginate
      { $sort: { allocDate: -1 } },
      { $skip: skip },
      { $limit: limitNumber },
    ];

    // run + paginate
    const raw = await InternalConsumption.aggregate(pipeline);
    const totalDocs = await InternalConsumption.countDocuments(matchCondition);
    const totalPages = Math.ceil(totalDocs / limitNumber);
    const docs = raw.map((r, i) => ({ ...r, serialNumber: i + 1 + skip }));

    return successResponse(
      'Internal Consumption Report fetched successfully',
      formatPaginationResult({
        docs,
        totalDocs,
        totalPages,
        currentPage: pageNumber,
      }),
    );
  } catch (err) {
    console.error('Error in internalConsumptionReport API:', err);
    return errorResponse(err);
  }
};
