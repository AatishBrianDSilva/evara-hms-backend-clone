import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { IPaginateOptions } from '@evara-backend/core/src/lib/types/pagination';
import formatPaginationResult from '@evara-backend/core/src/lib/utils/formatPaginationResult';
import { DrugVendor } from '@evara-backend/core/src/models/pharmacyDashboard/DrugVendor';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const auth = extractAuthorizerDetails(event);

  try {
    await connectMongoDb();

    const params = event.queryStringParameters || {};
    const {
      page = '1',
      limit = '10',
      sort: sortRaw,
      searchQuery = '',
      status = '',
    } = params; // Get status directly from params

    const sort = sortRaw ? JSON.parse(sortRaw) : undefined;
    const paginate = JSON.parse(params.paginate || 'false');

    if (paginate) {
      const options: IPaginateOptions = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        lean: true,
      };

      const query: any = {};

      if (sort) {
        options.sort = sort;
      }

      if (searchQuery) {
        query.$or = [{ name: new RegExp(searchQuery, 'i') }];
      }

      // Apply status filter if status "Active" is sent in the query string
      if (status === 'Active') {
        query.status = { $nin: ['Inactive'] }; // Fetch documents where status is not "Inactive"
      }

      // Add branchId and clinicId to the query
      query.branchId = auth.branchId;
      query.clinicId = auth.clinicId;

      // Fetching the drug vendors with pagination
      const result = await DrugVendor.paginate(query, options);
      const { records, pagination } = formatPaginationResult(result);

      return successResponse('Success', {
        records,
        pagination,
      });
    } else {
      const query: any = {
        branchId: auth.branchId,
        clinicId: auth.clinicId,
      };

      // Apply status filter if status "Active" is sent in the query string
      if (status === 'Active') {
        query.status = { $nin: ['Inactive'] }; // Fetch documents where status is not "Inactive"
      }

      // Fetching drug vendors without pagination
      const drugVendors = await DrugVendor.find(query).sort(sort).lean();

      return successResponse('Success', {
        records: drugVendors,
        pagination: {},
      });
    }
  } catch (error) {
    return errorResponse(error);
  }
};
