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

    const commonPipeline: any[] = [
      { $match: { clinicId: auth.clinicId, branchId: auth.branchId } },
      { $unwind: '$items' },
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
          from: 'drugitems',
          localField: 'itemDetails.item',
          foreignField: '_id',
          as: 'drugItemDetails',
        },
      },
      {
        $unwind: { path: '$drugItemDetails', preserveNullAndEmptyArrays: true },
      },
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
      ...(searchQuery
        ? [
            {
              $match: {
                $or: [
                  { icNumber: new RegExp(searchQuery, 'i') },
                  { 'drugItemDetails.name': new RegExp(searchQuery, 'i') },
                  { 'locationDetails.location': new RegExp(searchQuery, 'i') },
                  { 'patientDetails.firstName': new RegExp(searchQuery, 'i') },
                  { 'patientDetails.lastName': new RegExp(searchQuery, 'i') },
                ],
              },
            },
          ]
        : []),
    ];

    const result = await InternalConsumption.aggregate([
      {
        $facet: {
          paginatedResults: [
            ...commonPipeline,
            { $sort: sort },
            { $skip: (pageNum - 1) * limitNum },
            { $limit: limitNum },
            {
              $addFields: {
                unitPrice: {
                  $cond: [
                    {
                      $and: [
                        { $gt: ['$drugItemDetails.rate', 0] },
                        { $gt: ['$drugItemDetails.packSize', 0] },
                      ],
                    },
                    {
                      $divide: [
                        '$drugItemDetails.rate',
                        '$drugItemDetails.packSize',
                      ],
                    },
                    0,
                  ],
                },
                // grab the sellPrice & mrp from the matching batch
                unitMrp: {
                  $cond: [
                    {
                      $and: [
                        { $gt: ['$drugItemDetails.mrp', 0] },
                        { $gt: ['$drugItemDetails.packSize', 0] },
                      ],
                    },
                    {
                      $divide: [
                        '$drugItemDetails.mrp',
                        '$drugItemDetails.packSize',
                      ],
                    },
                    0,
                  ],
                },
              },
            },
            {
              $project: {
                _id: 1,
                icNumber: 1,
                date: 1,
                quantity: '$items.quantity',
                notes: '$items.notes',
                drugLocation: '$locationDetails.location',
                drugName: '$drugItemDetails.name',
                batchNo: { $arrayElemAt: ['$itemDetails.batches.batchNo', 0] },
                transferredBy: '$createdBy',
                patientName: {
                  $concat: [
                    { $ifNull: ['$patientDetails.firstName', ''] },
                    ' ',
                    { $ifNull: ['$patientDetails.lastName', ''] },
                  ],
                },
                report: {
                  reportName: '$report.reportName',
                  bucket: '$report.bucket',
                  key: '$report.key',
                },
                createdAt: 1,
                updatedAt: 1,
                cost: {
                  $multiply: ['$unitPrice', '$items.quantity'],
                },
                // unitMrp: 1,
                sellPrice: { $multiply: ['$unitMrp', '$items.quantity'] },
              },
            },
          ],
          totalCount: [...commonPipeline, { $count: 'totalDocs' }],
        },
      },
    ]);

    const records = result[0]?.paginatedResults || [];
    const totalRecords = result[0]?.totalCount[0]?.totalDocs || 0;
    const totalPages = Math.ceil(totalRecords / limitNum);

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
