import { APIGatewayProxyHandler } from 'aws-lambda';

import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { DrugManufacturer } from '@evara-backend/core/models/pharmacyDashboard/DrugManufacturer';
import { DrugCategory } from '@evara-backend/core/models/pharmacyDashboard/DrugCategory';
import { TaxRate } from '@evara-backend/core/src/models/pharmacyDashboard/TaxRate';
import { IPaginateOptions } from '@evara-backend/core/src/lib/types/pagination';
import formatPaginationResult from '@evara-backend/core/src/lib/utils/formatPaginationResult';
import { DrugItem } from '@evara-backend/core/src/models/pharmacyDashboard/DrugItem';
import { DrugType } from '@evara-backend/core/src/models/pharmacyDashboard/DrugType';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const auth = extractAuthorizerDetails(event);

  if (auth.clinicId == null) {
    throw new ErrorMessage(400, 'Clinic ID is required');
  }

  try {
    await connectMongoDb();

    const params = event.queryStringParameters || {};
    const {
      page = '1',
      limit = '10',
      searchQuery = '',
      sort: sortRaw,
      status = '',
    } = params;

    const sort = sortRaw ? JSON.parse(sortRaw) : undefined;

    const populate = [
      {
        path: 'category',
        model: DrugCategory.modelName,
      },
      {
        path: 'type',
        model: DrugType.modelName,
      },
      {
        path: 'manufacturer',
        model: DrugManufacturer.modelName,
      },
      {
        path: 'taxRate',
        model: TaxRate.modelName,
      },
    ];

    const paginate = JSON.parse(params.paginate || 'false');

    if (paginate) {
      const options: IPaginateOptions = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        lean: true,
      };

      if (sort) {
        options.sort = sort;
      }

      options.populate = populate;

      const query: any = {};
      query.clinicId = auth.clinicId;

      if (searchQuery) {
        query.$or = [
          { name: new RegExp(searchQuery, 'i') },
          { code: new RegExp(searchQuery, 'i') },
        ];
      }

      if (status === 'Active') {
        query.status = { $nin: ['Inactive'] }; // Fetch documents where status is not "Inactive"
      }

      // Fetching the appointments with pagination
      const result = await DrugItem.paginate(query, options);
      const { records, pagination } = formatPaginationResult(result);

      return successResponse('Success', {
        records,
        pagination,
      });
    } else {
      const query: any = {
        clinicId: auth.clinicId,
      };

      // Apply search query
      if (searchQuery) {
        query.$or = [
          { name: new RegExp(searchQuery, 'i') },
          { code: new RegExp(searchQuery, 'i') },
        ];
      }

      // Apply status filter if status "Active" is sent in the query string
      if (status === 'Active') {
        query.status = { $nin: ['Inactive'] }; // Fetch documents where status is not "Inactive"
      }

      // Fetching drug items without pagination
      const data = await DrugItem.find(query)
        .populate(populate)
        .sort(sort)
        .lean();

      return successResponse('Success', { records: data, pagination: {} });
    }
  } catch (error) {
    return errorResponse(error);
  }
};
