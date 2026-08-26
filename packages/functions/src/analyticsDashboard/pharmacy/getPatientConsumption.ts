import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import ErrorMessage from '@evara-backend/core/lib/utils/ErrorMessage';
import { PatientPharmacy } from '@evara-backend/core/src/models/patientDashboard/PatientPharmacy';
import { getISTDateRangeBounds } from '@evara-backend/core/src/lib/utils/formatDateIST';

/**
 * Patient name-wise pharmacy consumption (from PatientPharmacy allocations).
 */
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) throw new ErrorMessage(401, 'Unauthorized');
    await connectMongoDb();

    const params = event.queryStringParameters || {};
    const {
      page = '1',
      limit = '25',
      paginate = 'true',
      saleStartDate,
      saleEndDate,
      search = '',
    } = params;

    const isPaginated = paginate === 'true';
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    const matchFilter: any = {
      clinicId: auth.clinicId,
      branchId: auth.branchId,
    };

    const { start, end } = getISTDateRangeBounds(saleStartDate, saleEndDate);
    if (start || end) {
      matchFilter.date = {
        ...(start && { $gte: start }),
        ...(end && { $lte: end }),
      };
    }

    const pipeline: any[] = [
      { $match: matchFilter },
      { $unwind: '$item.details' },
      {
        $addFields: {
          lineValue: {
            $multiply: [
              {
                $cond: [
                  { $gt: ['$item.details.packSize', 0] },
                  {
                    $divide: ['$item.details.mrp', '$item.details.packSize'],
                  },
                  '$item.details.mrp',
                ],
              },
              '$item.details.quantity',
            ],
          },
        },
      },
      {
        $group: {
          _id: '$patient',
          patientId: { $first: '$patient' },
          totalQuantity: { $sum: '$item.details.quantity' },
          totalValue: { $sum: '$lineValue' },
          allocationCount: { $sum: 1 },
          lastDate: { $max: '$date' },
        },
      },
      {
        $lookup: {
          from: 'patients',
          localField: 'patientId',
          foreignField: 'patientId',
          as: 'patientDetails',
        },
      },
      {
        $unwind: {
          path: '$patientDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          patientName: {
            $trim: {
              input: {
                $concat: [
                  { $ifNull: ['$patientDetails.firstName', ''] },
                  ' ',
                  { $ifNull: ['$patientDetails.lastName', ''] },
                ],
              },
            },
          },
        },
      },
    ];

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      pipeline.push({
        $match: {
          $or: [{ patientId: searchRegex }, { patientName: searchRegex }],
        },
      });
    }

    pipeline.push({ $sort: { totalValue: -1 } });

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
              id: '$patientId',
              patientId: 1,
              patientName: 1,
              totalQuantity: 1,
              totalValue: 1,
              allocationCount: 1,
              lastDate: 1,
            },
          },
        ],
        totalCount: [{ $count: 'count' }],
        summary: [
          {
            $group: {
              _id: null,
              totalQuantity: { $sum: '$totalQuantity' },
              totalValue: { $sum: '$totalValue' },
              patientCount: { $sum: 1 },
            },
          },
        ],
      },
    });

    const result = await PatientPharmacy.aggregate(pipeline);
    const facet = result[0] || {};
    const records = facet.records || [];
    const totalDocs = facet.totalCount?.[0]?.count || 0;
    const summary = facet.summary?.[0] || {
      totalQuantity: 0,
      totalValue: 0,
      patientCount: 0,
    };

    return successResponse('Patient consumption report fetched successfully', {
      records,
      pagination: {
        totalDocs,
        page: pageNumber,
        limit: limitNumber,
      },
      summary: {
        totalQuantity: summary.totalQuantity || 0,
        totalValue: summary.totalValue || 0,
        patientCount: summary.patientCount || 0,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
};
