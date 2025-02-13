import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/src/lib/utils/extractAuthorizerDetails';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import { PharmacyStock } from '@evara-backend/core/models/pharmacyDashboard/PharmacyStock';

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
    const sort = sortRaw ? JSON.parse(sortRaw) : { updatedAt: -1 };

    console.log('Received searchQuery:', searchQuery);

    // Build aggregation pipeline
    const pipeline: any[] = [
      { $match: { branchId: auth.branchId, clinicId: auth.clinicId } },
      {
        $lookup: {
          from: 'drugitems',
          localField: 'item',
          foreignField: '_id',
          as: 'itemDetails',
        },
      },
      { $unwind: '$itemDetails' },
    ];

    // Add search filter if provided
    if (searchQuery) {
      pipeline.push({
        $match: {
          'itemDetails.name': { $regex: searchQuery, $options: 'i' },
        },
      });
    }

    pipeline.push(
      {
        $unwind: '$batches',
      },
      {
        $unwind: '$batches.locations',
      },
      {
        $lookup: {
          from: 'druglocations',
          localField: 'batches.locations.location',
          foreignField: '_id',
          as: 'locationDetails',
        },
      },
      {
        $unwind: {
          path: '$locationDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: '$_id',
          itemDetails: { $first: '$itemDetails' },
          updatedAt: { $first: '$updatedAt' },
          batches: {
            $push: {
              batchNo: '$batches.batchNo',
              expiryDate: '$batches.expiryDate',
              sellPrice: '$batches.sellPrice',
              location: '$locationDetails.location',
              quantity: '$batches.locations.quantity',
            },
          },
        },
      },
      { $sort: sort },
      {
        $project: {
          'itemDetails.name': 1,
          'itemDetails.category': 1,
          'batches.batchNo': 1,
          'batches.expiryDate': 1,
          'batches.sellPrice': 1,
          'batches.location': 1,
          'batches.quantity': 1,
          updatedAt: 1,
        },
      },
    );

    const rawResult = await PharmacyStock.aggregate(pipeline);

    // Format the records into batch-wise rows
    const formattedRecords = formatBatchwiseRecords(rawResult);

    // Manual pagination after formatting
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const totalDocs = formattedRecords.length;
    const totalPages = Math.ceil(totalDocs / limitNumber);
    const paginatedRecords = formattedRecords.slice(
      (pageNumber - 1) * limitNumber,
      pageNumber * limitNumber,
    );

    return successResponse('Success', {
      records: paginatedRecords,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        totalDocs,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return errorResponse(error);
  }
};

const formatBatchwiseRecords = (records: any[]) =>
  records.flatMap(record => {
    return record.batches.map(batch => ({
      batchNo: batch.batchNo,
      itemName: record.itemDetails?.name || 'N/A',
      category: record.itemDetails?.category || 'N/A',
      expiryDate: batch.expiryDate,
      sellPrice: batch.sellPrice || 0,
      updatedAt: record.updatedAt,
      totalQuantity: batch.quantity,
      quantityAtLocation: [
        {
          locationName: batch.location || 'Unknown',
          quantity: batch.quantity,
        },
      ],
    }));
  });
