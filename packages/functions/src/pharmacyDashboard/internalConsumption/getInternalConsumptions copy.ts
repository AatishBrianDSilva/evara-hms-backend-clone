import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/src/lib/utils/extractAuthorizerDetails';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import { InternalConsumption } from '@evara-backend/core/models/pharmacyDashboard/InternalConsumption';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, 'Unauthorized');
    }

    await connectMongoDb();

    // Extract query parameters
    const params = event.queryStringParameters || {};
    const {
      page = '1',
      limit = '10',
      sort: sortRaw,
      searchQuery = '',
    } = params;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const sort = sortRaw ? JSON.parse(sortRaw) : { updatedAt: -1 };

    console.log('Received searchQuery:', searchQuery);

    // Aggregation pipeline shared between pagination and count
    const commonPipeline: any[] = [
      { $match: { clinicId: auth.clinicId, branchId: auth.branchId } },
      { $unwind: '$items' },

      // Lookups
      {
        $lookup: {
          from: 'pharmacystocks',
          localField: 'items.item',
          foreignField: '_id',
          as: 'itemDetails',
        },
      },
      { $unwind: { path: '$itemDetails', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'druglocations',
          localField: 'items.transferFrom.location',
          foreignField: '_id',
          as: 'locationDetails',
        },
      },
      {
        $unwind: { path: '$locationDetails', preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: 'patients',
          localField: 'items.patientId',
          foreignField: 'patientId',
          as: 'patientDetails',
        },
      },
      {
        $unwind: { path: '$patientDetails', preserveNullAndEmptyArrays: true },
      },

      // Optional search filter
      ...(searchQuery
        ? [
            {
              $match: {
                $or: [
                  { icNumber: new RegExp(searchQuery, 'i') },
                  { 'itemDetails.name': new RegExp(searchQuery, 'i') },
                  { 'locationDetails.location': new RegExp(searchQuery, 'i') },
                  { 'patientDetails.firstName': new RegExp(searchQuery, 'i') },
                  { 'patientDetails.lastName': new RegExp(searchQuery, 'i') },
                ],
              },
            },
          ]
        : []),
    ];

    // Full aggregation with pagination and counting in facets
    const result = await InternalConsumption.aggregate([
      {
        $facet: {
          paginatedResults: [
            ...commonPipeline,
            { $sort: sort },
            { $skip: (pageNum - 1) * limitNum },
            { $limit: limitNum },
            {
              $project: {
                _id: 1,
                icNumber: 1,
                date: 1,
                quantity: '$items.quantity',
                notes: '$items.notes',
                drugLocation: '$locationDetails.location',
                drugName: '$itemDetails.item.name',
                batchNo: { $arrayElemAt: ['$itemDetails.batches.batchNo', 0] },
                transferredBy: '$createdBy',
                patientName: {
                  $concat: [
                    { $ifNull: ['$patientDetails.firstName', ''] },
                    ' ',
                    { $ifNull: ['$patientDetails.lastName', ''] },
                  ],
                },
              },
            },
          ],
          totalCount: [...commonPipeline, { $count: 'totalDocs' }],
        },
      },
    ]);

    // Extract data from the aggregation result
    const records = result[0]?.paginatedResults || [];
    const totalRecords = result[0]?.totalCount[0]?.totalDocs || 0;

    const totalPages = Math.ceil(totalRecords / limitNum);

    // Return the response
    return successResponse('Success', {
      records,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalDocs: totalRecords,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching internal consumption data:', error);
    return errorResponse(error);
  }
};
