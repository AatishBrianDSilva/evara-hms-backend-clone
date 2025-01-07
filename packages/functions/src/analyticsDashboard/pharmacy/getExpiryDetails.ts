import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { PharmacyStock } from '@evara-backend/core/src/models/pharmacyDashboard/PharmacyStock';
import formatPaginationResult from '@evara-backend/core/src/lib/utils/formatPaginationResult';
import Branch from '@evara-backend/core/models/mastersDashboard/global/ClinicBranches';
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
    const {
      page = '1',
      limit = '25',
      drugName = '',
      startDate,
      endDate,
    } = params;

    // Calculate skip and limit for pagination
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const pageSize = parseInt(limit, 10);

    // Build match condition for drugName and expiryDate filtering
    const matchCondition: any = {
      branchId: auth.branchId, // Filter by branch
    };

    // console.log("Current Branch", branchId);

    if (drugName) {
      matchCondition['drugItem.name'] = { $regex: new RegExp(drugName, 'i') }; // Case-insensitive partial match
    }

    // Add date range filter on expiryDate while ignoring the time part
    if (startDate || endDate) {
      const startDateObj = startDate ? new Date(startDate) : null;
      const endDateObj = endDate ? new Date(endDate) : null;

      matchCondition['batches.expiryDate'] = {
        ...(startDateObj && {
          $gte: new Date(startDateObj.setUTCHours(0, 0, 0, 0)), // Start of the day (ignoring time)
        }),
        ...(endDateObj && {
          $lte: new Date(endDateObj.setUTCHours(23, 59, 59, 999)), // End of the day (ignoring time)
        }),
      };
    }

    // Aggregation pipeline
    const aggregationPipeline = [
      {
        $lookup: {
          from: 'drugitems', // DrugItem collection name
          localField: 'item',
          foreignField: '_id',
          as: 'drugItem',
        },
      },
      {
        $unwind: { path: '$drugItem', preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: 'drugcategories', // DrugCategory collection name
          localField: 'drugItem.category',
          foreignField: '_id',
          as: 'drugCategory',
        },
      },
      {
        $unwind: { path: '$drugCategory', preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: 'drugvendors', // DrugVendor collection name
          localField: 'batches.vendor',
          foreignField: '_id',
          as: 'vendorDetails',
        },
      },
      {
        $unwind: { path: '$batches', preserveNullAndEmptyArrays: true }, // Unwind the batches array for each stock
      },
      {
        $unwind: {
          path: '$batches.locations',
          preserveNullAndEmptyArrays: true,
        }, // Unwind the locations array for each batch
      },
      {
        $addFields: {
          batchSellPrice: '$batches.sellPrice', // Directly map batch-level sellPrice

          totalQty: {
            $sum: '$batches.locations.quantity', // Calculate total quantity for each document
          },
        },
      },

      {
        $addFields: {
          sumTotalValue: {
            $multiply: [
              '$batchSellPrice',
              { $sum: '$batches.locations.quantity' }, // Multiply batchSellPrice by total quantity
            ],
          },
          unitCost: '$batches.sellPrice', // Use batch-level sellPrice directly as unit cost
        },
      },
      {
        $addFields: {
          vendorName: {
            $arrayElemAt: [
              {
                $filter: {
                  input: '$vendorDetails',
                  as: 'vendor',
                  cond: { $eq: ['$$vendor._id', '$batches.vendor'] },
                },
              },
              0,
            ],
          },
        },
      },
      {
        $addFields: {
          serialNumber: {
            $add: [
              {
                $multiply: [
                  { $subtract: [parseInt(page, 10), 1] },
                  parseInt(limit, 10),
                ],
              },
              { $add: ['$index', 1] },
            ],
          },
          centre: { $concat: ['$clinicId', '$branchId'] },
          invoiceNo: '$_id', // Assuming stock ID is used as invoice number
          vendorName: { $ifNull: ['$vendorName.name', 'N/A'] },
          drugCategory: { $ifNull: ['$drugCategory.name', 'N/A'] },
          drugName: { $ifNull: ['$drugItem.name', 'N/A'] },
          batchNo: { $ifNull: ['$batches.batchNo', 'N/A'] },
          expiryDate: {
            $cond: {
              if: { $ne: ['$batches.expiryDate', null] },
              then: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$batches.expiryDate',
                },
              },
              else: 'N/A',
            },
          },
        },
      },
      {
        $match: matchCondition, // Apply drugName and expiryDate filters if provided
      },
      {
        $project: {
          _id: 0,
          serialNumber: 1,
          centre: 1,
          invoiceNo: 1,
          vendorName: 1,
          drugCategory: 1,
          drugName: 1,
          batchNo: 1,
          expiryDate: 1,
          unitCost: 1,
          totalQty: 1,
          sumTotalValue: 1,
        },
      },
      { $sort: { drugName: 1 } }, // Sort by drug name
      { $skip: skip },
      { $limit: parseInt(limit, 10) },
    ];

    // Fetch paginated and aggregated pharmacy stock items
    const stocks = await PharmacyStock.aggregate(aggregationPipeline);

    // Fetch the total document count for pagination
    const totalDocs = await PharmacyStock.countDocuments(matchCondition);
    const totalPages = Math.ceil(totalDocs / pageSize);

    // Assign serial numbers to the rows based on the page and limit
    const serialStart = (parseInt(page, 10) - 1) * pageSize + 1;
    const expiryReportWithSerial = stocks.map((row, index) => ({
      ...row,
      serialNumber: serialStart + index, // Ensure serial number starts from the correct value
    }));

    // Format the final result with pagination information
    const paginatedResult = formatPaginationResult({
      docs: expiryReportWithSerial,
      totalDocs,
      totalPages,
      currentPage: parseInt(page, 10),
    });

    console.log(
      'Final Expiry Details Report with Pagination: ',
      paginatedResult,
    );

    return successResponse(
      'Expiry Details fetched successfully',
      paginatedResult,
    );
  } catch (error) {
    console.error('Error in expiryDetails API: ', error);
    return errorResponse(error);
  }
};
