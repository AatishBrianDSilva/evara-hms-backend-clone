import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import formatPaginationResult from '@evara-backend/core/src/lib/utils/formatPaginationResult';
import { IPaginateOptions } from '@evara-backend/core/src/lib/types/pagination';
import { DrugVendor } from '@evara-backend/core/src/models/pharmacyDashboard/DrugVendor';
import { DrugItem } from '@evara-backend/core/src/models/pharmacyDashboard/DrugItem';
import Branch from '@evara-backend/core/models/mastersDashboard/global/ClinicBranches';
import { PurchaseOrder } from '@evara-backend/core/src/models/pharmacyDashboard/PurchaseOrder';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';

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
      status,
      searchQuery = '',
      vendorName = '', // Adjust to use vendorName from filters
      itemStatus = '', // New parameter for item status filtering
      saleStartDate, // Start date for filtering
      saleEndDate, // End date for filtering
    } = params;

    const sort = sortRaw ? JSON.parse(sortRaw) : undefined;

    const populate = [
      {
        path: 'vendor',
        model: DrugVendor.modelName,
      },
      {
        path: 'request.items.item',
        model: DrugItem.modelName,
      },
      {
        path: 'branch',
        model: Branch.modelName,
      },
    ];

    const query: any = {};
    query.branchId = auth.branchId;
    query.clinicId = auth.clinicId;

    if (status) {
      query.status = status;
    }

    if (searchQuery) {
      query.$or = [{ poNumber: new RegExp(searchQuery, 'i') }];
    }

    // Vendor name filtering
    if (vendorName) {
      // Fetch vendors matching the name
      const matchingVendors = await DrugVendor.find({
        name: new RegExp(vendorName, 'i'),
      })
        .select('_id')
        .lean();

      const vendorIds = matchingVendors.map(vendor => vendor._id);

      if (vendorIds.length > 0) {
        query.vendor = { $in: vendorIds };
      } else {
        // Return empty result if no matching vendors
        return successResponse('No matching vendors found', {
          records: [],
          pagination: { totalDocs: 0, totalPages: 0, page: 1, limit: 10 },
        });
      }
    }

    // Item status filtering
    if (itemStatus) {
      query['request.items.status'] = itemStatus;
    }

    // Date range filtering (ignoring time)
    if (saleStartDate || saleEndDate) {
      const startDate = saleStartDate ? new Date(saleStartDate) : null;
      const endDate = saleEndDate ? new Date(saleEndDate) : null;

      query.createdAt = {
        ...(startDate && { $gte: new Date(startDate.setHours(0, 0, 0, 0)) }), // Start of the day
        ...(endDate && { $lte: new Date(endDate.setHours(23, 59, 59, 999)) }), // End of the day
      };
    }

    console.log('Final query for PurchaseOrder:', JSON.stringify(query));

    const paginate = JSON.parse(params.paginate || 'false');

    if (paginate) {
      const options: IPaginateOptions = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        lean: true,
        sort,
        populate,
      };

      const result = await PurchaseOrder.paginate(query, options);
      const { records, pagination } = formatPaginationResult(result);

      // Add allResponsesNetAmount to each record
      const recordsWithTotalNetAmount = records.map(record => {
          const responseNetAmount = record.responses?.reduce(
            (sum, response) => sum + (response.netAmount || 0),
                0
              );
          return {
              ...record,
              allResponsesNetAmount: responseNetAmount || 0,
            };
        });

      return successResponse('Success', {
        records: recordsWithTotalNetAmount,
        pagination,
      });
    } else {
      const data = await PurchaseOrder.find(query)
        .populate(populate)
        .sort(sort)
        .lean();

      return successResponse('Success', {
        records: data,
      });
    }
  } catch (error) {
    return errorResponse(error);
  }
};
