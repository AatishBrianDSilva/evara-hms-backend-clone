import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { DrugItem } from '@evara-backend/core/src/models/pharmacyDashboard/DrugItem';
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

    // Extract query string parameters for pagination and filtering
    const params = event.queryStringParameters || {};
    const { page = '1', limit = '25', drugName = '' } = params;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    // Build match condition for drugName filtering
    const matchCondition: any = {
      clinicId: auth.clinicId, // Filter by clinic
      status: 'Active', // Only active drug items
    };

    if (drugName) {
      matchCondition.name = { $regex: new RegExp(drugName, 'i') }; // Case-insensitive partial match
    }

    // Aggregation pipeline
    const aggregationPipeline = [
      { $match: matchCondition },
      {
        $lookup: {
          from: 'drugcategories',
          localField: 'category',
          foreignField: '_id',
          as: 'drugCategory',
        },
      },
      {
        $lookup: {
          from: 'drugtypes',
          localField: 'type',
          foreignField: '_id',
          as: 'drugType',
        },
      },
      {
        $lookup: {
          from: 'drugmanufacturers',
          localField: 'manufacturer',
          foreignField: '_id',
          as: 'drugManufacturer',
        },
      },
      {
        $lookup: {
          from: 'pharmacystocks',
          localField: '_id',
          foreignField: 'item',
          as: 'pharmacyStock',
        },
      },
      {
        $addFields: {
          drugCategory: {
            $ifNull: [{ $arrayElemAt: ['$drugCategory.name', 0] }, 'N/A'],
          },
          categoryCode: {
            $ifNull: [{ $arrayElemAt: ['$drugCategory._id', 0] }, 'N/A'],
          },
          drugType: {
            $ifNull: [{ $arrayElemAt: ['$drugType.name', 0] }, 'N/A'],
          },
          typeCode: {
            $ifNull: [{ $arrayElemAt: ['$drugType._id', 0] }, 'N/A'],
          },
          drugCompany: {
            $ifNull: [{ $arrayElemAt: ['$drugManufacturer.name', 0] }, 'N/A'],
          },
          companyCode: {
            $ifNull: [{ $arrayElemAt: ['$drugManufacturer.tin', 0] }, 'N/A'],
          },
          qtyPerPack: { $ifNull: ['$packSize', 0] },
          drugName: { $ifNull: ['$name', 'N/A'] },
          drugCode: { $ifNull: ['$code', 'N/A'] },
          hsnCode: { $ifNull: ['$hsnCode', 'N/A'] },
          units: {
            $ifNull: [
              {
                $sum: {
                  $map: {
                    input: '$pharmacyStock.batches',
                    as: 'batch',
                    in: {
                      $sum: {
                        $map: {
                          input: '$$batch.locations',
                          as: 'location',
                          in: '$$location.quantity',
                        },
                      },
                    },
                  },
                },
              },
              0,
            ],
          },
          updatedAt: {
            $ifNull: [
              { $arrayElemAt: ['$pharmacyStock.updatedAt', 0] },
              new Date(0),
            ],
          },
        },
      },
      {
        $project: {
          drugCategory: 1,
          categoryCode: 1,
          drugType: 1,
          typeCode: 1,
          drugCompany: 1,
          companyCode: 1,
          drugName: 1,
          drugCode: 1,
          hsnCode: 1,
          qtyPerPack: 1,
          units: 1,
          updatedAt: 1,
        },
      },
      { $sort: { updatedAt: -1 } }, // Sort by updatedAt in descending order
      { $skip: skip },
      { $limit: limitNumber },
    ];

    // Fetch paginated and aggregated drug items
    const drugItems = await DrugItem.aggregate(aggregationPipeline);

    // Count the total number of documents that match the condition
    const countPipeline = [{ $match: matchCondition }, { $count: 'totalDocs' }];
    const countResult = await DrugItem.aggregate(countPipeline);
    const totalDocs = countResult.length > 0 ? countResult[0].totalDocs : 0;

    const totalPages = Math.ceil(totalDocs / limitNumber);

    // Add serial numbers to each row
    const drugItemsWithSerial = drugItems.map((row, index) => ({
      ...row,
      serialNumber: index + 1 + skip,
    }));

    // Format the final result with pagination information
    const paginatedResult = formatPaginationResult({
      docs: drugItemsWithSerial,
      totalDocs,
      totalPages,
      currentPage: pageNumber,
    });

    return successResponse(
      'Drug and Vendor Report fetched successfully',
      paginatedResult,
    );
  } catch (error) {
    console.error('Error in getDrugsAndVendors API: ', error);
    return errorResponse(error);
  }
};
