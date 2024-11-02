import { APIGatewayProxyHandler } from 'aws-lambda';

import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import formatPaginationResult from '@evara-backend/core/src/lib/utils/formatPaginationResult';
import { IPaginateOptions } from '@evara-backend/core/src/lib/types/pagination';
import { DrugLocation } from '@evara-backend/core/src/models/pharmacyDashboard/DrugLocation';
import { PharmacyStock } from '@evara-backend/core/src/models/pharmacyDashboard/PharmacyStock';
import { InternalConsumption } from '@evara-backend/core/src/models/pharmacyDashboard/InternalConsumption';
import { DrugItem } from '@evara-backend/core/src/models/pharmacyDashboard/DrugItem';
import { extractAuthorizerDetails } from '@evara-backend/core/src/lib/utils/extractAuthorizerDetails';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';

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
      paginate,
      sort: sortRaw,
      searchQuery = '',
    } = params;

    const sort = sortRaw ? JSON.parse(sortRaw) : undefined;

    const populate = [
      {
        path: 'items.item',
        model: PharmacyStock.modelName,
        populate: [
          {
            path: 'item',
            model: DrugItem.modelName,
          },
        ],
      },
      {
        path: 'items.transferFrom.location',
        model: DrugLocation.modelName,
      },
    ];

    const query: any = {};
    query.branchId = auth.branchId;
    query.clinicId = auth.clinicId;

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

      if (searchQuery) {
        query.$or = [{ icNumber: new RegExp(searchQuery, 'i') }];
      }

      const result = await InternalConsumption.paginate(query, options);
      const { records, pagination } = formatPaginationResult(result);

      return successResponse('Success', {
        records,
        pagination,
      });
    } else {
      const data = await InternalConsumption.find(query)
        .populate(populate)
        .sort(sort)
        .lean();

      return successResponse('Success', data);
    }
  } catch (error) {
    return errorResponse(error);
  }
};
