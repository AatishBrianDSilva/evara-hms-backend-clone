import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { PharmacyStock } from '@evara-backend/core/src/models/pharmacyDashboard/PharmacyStock';
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
    const { page = '1', limit = '25', drugName = '' } = params;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const pageSize = parseInt(limit, 10);

    // Build match condition for drugName filtering
    const matchCondition: any = {
      branchId: auth.branchId, // Filter by branch
    };

    if (drugName) {
      matchCondition['drugItem.name'] = { $regex: new RegExp(drugName, 'i') }; // Case-insensitive partial match
    }

    // Define location name mappings to specific categories
    const locationMapping = {
      'Central Pharmacy': 'Central',
      'OPD Pharmacy': 'OPD',
      'OT Pharmacy': 'OT',
      'Recovery Pharmacy': 'Recovery',
      'IVF Pharmacy': 'IVF',
      'Emergency Pharmacy': 'Returns',
      'Internal Stock': 'Internal',
      'Staging Pharmacy': 'Staging',
    };

    // Aggregation pipeline to fetch all required data
    const aggregationPipeline = [
      {
        $lookup: {
          from: 'drugitems', // DrugItem collection
          localField: 'item',
          foreignField: '_id',
          as: 'drugItem',
        },
      },
      {
        $unwind: { path: '$drugItem', preserveNullAndEmptyArrays: true },
      },
      {
        $match: matchCondition, // Apply filtering for drug name
      },
      {
        $lookup: {
          from: 'drugcategories', // DrugCategory collection
          localField: 'drugItem.category',
          foreignField: '_id',
          as: 'drugCategory',
        },
      },
      {
        $unwind: { path: '$drugCategory', preserveNullAndEmptyArrays: true },
      },
      {
        $unwind: { path: '$batches', preserveNullAndEmptyArrays: true }, // Unwind batches array
      },
      {
        $unwind: {
          path: '$batches.locations',
          preserveNullAndEmptyArrays: true,
        }, // Unwind locations array
      },
      {
        $lookup: {
          from: 'druglocations', // DrugLocation collection
          localField: 'batches.locations.location',
          foreignField: '_id',
          as: 'locationDetails',
        },
      },
      {
        $unwind: { path: '$locationDetails', preserveNullAndEmptyArrays: true },
      },
      {
        $group: {
          _id: {
            clinicId: '$clinicId',
            branchId: '$branchId',
            item: '$item',
            batchId: '$batches._id',
          },
          drugCategory: { $first: '$drugCategory.name' },
          // drugCatCode: { $first: "$drugCategory._id" },
          drugName: { $first: '$drugItem.name' },
          drugCode: { $first: '$drugItem.code' },
          centre: { $first: { $concat: ['$clinicId', '$branchId'] } },
          // Sum quantity based on location name mapping
          Central: {
            $sum: {
              $cond: [
                { $eq: ['$locationDetails.location', 'Central Pharmacy'] },
                '$batches.locations.quantity',
                0,
              ],
            },
          },
          OPD: {
            $sum: {
              $cond: [
                { $eq: ['$locationDetails.location', 'OPD Pharmacy'] },
                '$batches.locations.quantity',
                0,
              ],
            },
          },
          OT: {
            $sum: {
              $cond: [
                { $eq: ['$locationDetails.location', 'OT Pharmacy'] },
                '$batches.locations.quantity',
                0,
              ],
            },
          },
          Recovery: {
            $sum: {
              $cond: [
                { $eq: ['$locationDetails.location', 'Recovery Pharmacy'] },
                '$batches.locations.quantity',
                0,
              ],
            },
          },
          IVF: {
            $sum: {
              $cond: [
                { $eq: ['$locationDetails.location', 'IVF Pharmacy'] },
                '$batches.locations.quantity',
                0,
              ],
            },
          },
          Returns: {
            $sum: {
              $cond: [
                { $eq: ['$locationDetails.location', 'Emergency Pharmacy'] },
                '$batches.locations.quantity',
                0,
              ],
            },
          },
          Internal: {
            $sum: {
              $cond: [
                { $eq: ['$locationDetails.location', 'Internal Stock'] },
                '$batches.locations.quantity',
                0,
              ],
            },
          },
          // Staging: {
          //   $sum: {
          //     $cond: [
          //       { $eq: ["$locationDetails.location", "Staging Pharmacy"] },
          //       "$batches.locations.quantity",
          //       0,
          //     ],
          //   },
          // },
          // Other: {
          //   $sum: {
          //     $cond: [
          //       {
          //         $not: {
          //           $in: [
          //             "$locationDetails.location",
          //             [
          //               "Central Pharmacy",
          //               "OPD Pharmacy",
          //               "OT Pharmacy",
          //               "Recovery Pharmacy",
          //               "IVF Pharmacy",
          //               "Emergency Pharmacy",
          //               "Internal Stock",
          //               "Staging Pharmacy",
          //             ],
          //           ],
          //         },
          //       },
          //       "$batches.locations.quantity",
          //       0,
          //     ],
          //   },
          // },
          totalQty: { $sum: '$batches.locations.quantity' },
        },
      },
      {
        $sort: { 'drugItem.name': 1 }, // Sort by drug name for clarity
      },
      {
        $skip: skip,
      },
      {
        $limit: pageSize,
      },
    ];

    // Execute aggregation pipeline
    const report = await PharmacyStock.aggregate(aggregationPipeline);

    // Fetch total document count for pagination using match condition
    const totalDocs = await PharmacyStock.countDocuments(matchCondition);
    const totalPages = Math.ceil(totalDocs / pageSize);

    // Assign serial numbers
    const reportWithSerial = report.map((row, index) => ({
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

    console.log('Final Stock Report with Pagination: ', paginatedResult);

    return successResponse(
      'Stock Report fetched successfully',
      paginatedResult,
    );
  } catch (error) {
    console.error('Error in stockReport API: ', error);
    return errorResponse(error);
  }
};
