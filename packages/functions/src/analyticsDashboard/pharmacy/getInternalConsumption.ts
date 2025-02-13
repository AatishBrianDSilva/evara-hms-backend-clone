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
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, 'Unauthorized');
    }

    await connectMongoDb();

    const params = event.queryStringParameters || {};
    const { page = '1', limit = '25', saleStartDate, saleEndDate } = params;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const matchCondition: any = {
      branchId: auth.branchId,
    };

    if (saleStartDate || saleEndDate) {
      const startDate = saleStartDate ? new Date(saleStartDate) : null;
      const endDate = saleEndDate ? new Date(saleEndDate) : null;

      matchCondition.date = {
        ...(startDate && { $gte: new Date(startDate.setHours(0, 0, 0, 0)) }),
        ...(endDate && { $lte: new Date(endDate.setHours(23, 59, 59, 999)) }),
      };
    }

    const pipeline: any[] = [
      { $match: matchCondition },
      { $unwind: '$items' },
      { $unwind: '$items.batches' },
      {
        $lookup: {
          from: 'pharmacystocks',
          localField: 'items.item',
          foreignField: '_id',
          as: 'pharmacyStock',
        },
      },
      { $unwind: { path: '$pharmacyStock', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'drugitems',
          localField: 'pharmacyStock.item',
          foreignField: '_id',
          as: 'drugItem',
        },
      },
      { $unwind: { path: '$drugItem', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'drugcategories',
          localField: 'drugItem.category',
          foreignField: '_id',
          as: 'drugCategory',
        },
      },
      { $unwind: { path: '$drugCategory', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'druglocations',
          localField: 'items.transferFrom.location',
          foreignField: '_id',
          as: 'location',
        },
      },
      { $unwind: { path: '$location', preserveNullAndEmptyArrays: true } },

      // Fix for cost calculation
      {
        $addFields: {
          centre: { $concat: ['$clinicId', '-', '$branchId'] },
          pharmacyDrugName: '$drugItem.name',
          pharmacyDrugCode: '$drugItem.code',
          locationName: '$location.location',
          locationCode: { $ifNull: ['$location._id', 'N/A'] },
          category: { $ifNull: ['$drugCategory.name', 'N/A'] },
          categoryCode: { $ifNull: ['$drugCategory._id', 'N/A'] },
          quantity: '$items.batches.deductedQuantity',

          unitCost: {
            $ifNull: [
              { $arrayElemAt: ['$pharmacyStock.batches.sellPrice', 0] },
              0,
            ],
          },
          totalCost: {
            $multiply: [
              '$items.batches.deductedQuantity',
              {
                $ifNull: [
                  { $arrayElemAt: ['$pharmacyStock.batches.sellPrice', 0] },
                  0,
                ],
              },
            ],
          },
          tax: {
            $multiply: [
              {
                $ifNull: [
                  { $arrayElemAt: ['$pharmacyStock.batches.sellPrice', 0] },
                  0,
                ],
              },
              0.1, // Assuming 10% tax
            ],
          },
          totalTax: {
            $multiply: [
              '$items.batches.deductedQuantity',
              {
                $multiply: [
                  {
                    $ifNull: [
                      { $arrayElemAt: ['$pharmacyStock.batches.sellPrice', 0] },
                      0,
                    ],
                  },
                  0.1, // 10% tax
                ],
              },
            ],
          },

          allocDate: '$date',
          addedBy: '$createdBy',
          remarks: { $ifNull: ['$items.notes', 'N/A'] },
        },
      },
      {
        $project: {
          _id: 0,
          serialNumber: 1,
          centre: 1,
          pharmacyDrugName: 1,
          pharmacyDrugCode: 1,
          locationName: 1,
          locationCode: 1,
          category: 1,
          categoryCode: 1,
          quantity: 1,
          unitCost: 1,
          totalCost: 1,
          tax: 1,
          totalTax: 1,
          allocDate: 1,
          addedBy: 1,
          remarks: 1,
        },
      },
      { $sort: { allocDate: -1 } },
      { $skip: skip },
      { $limit: limitNumber },
    ];

    // Run the aggregation pipeline
    const internalConsumptionReport =
      await InternalConsumption.aggregate(pipeline);

    // Fetch the total document count for pagination
    const totalDocs = await InternalConsumption.countDocuments(matchCondition);
    const totalPages = Math.ceil(totalDocs / limitNumber);

    // Add serial numbers to each row
    const reportWithSerial = internalConsumptionReport.map((row, index) => ({
      ...row,
      serialNumber: index + 1 + skip,
    }));

    // Format the final result with pagination information
    const paginatedResult = formatPaginationResult({
      docs: reportWithSerial,
      totalDocs,
      totalPages,
      currentPage: parseInt(page, 10),
    });
    return successResponse(
      'Internal Consumption Report fetched successfully',
      paginatedResult,
    );
  } catch (error) {
    console.error('Error in internalConsumptionReport API: ', error);
    return errorResponse(error);
  }
};
