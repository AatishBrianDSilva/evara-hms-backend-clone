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
import { extractAuthorizerDetails } from '@evara-backend/core/src/lib/utils/extractAuthorizerDetails';

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
      vendorName = '',
      itemStatus = '',
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

    if (vendorName) {
      const matchingVendors = await DrugVendor.find({
        name: new RegExp(vendorName, 'i'),
      })
        .select('_id')
        .lean();

      const vendorIds = matchingVendors.map(vendor => vendor._id);

      if (vendorIds.length > 0) {
        query.vendor = { $in: vendorIds };
      } else {
        return successResponse('No matching vendors found', {
          records: [],
          pagination: { totalDocs: 0, totalPages: 0, page: 1, limit: 10 },
        });
      }
    }

    if (itemStatus) {
      query['request.items.status'] = itemStatus;
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

      // Flatten the responses
      const flattenedRecords = records.flatMap(order =>
        (order.responses || []).map((response, index) => ({
          ...order,
          response,
          responseIndex: index + 1,
        })),
      );

      return successResponse('Success', {
        records: flattenedRecords,
        pagination,
      });
    } else {
      const data = await PurchaseOrder.find(query)
        .populate(populate)
        .sort(sort)
        .lean();

      const flattenedData = data.flatMap(order =>
        (order.responses || []).map((response, index) => ({
          ...order,
          response,
          responseIndex: index + 1,
        })),
      );

      return successResponse('Success', {
        records: flattenedData,
      });
    }
  } catch (error) {
    return errorResponse(error);
  }
};
