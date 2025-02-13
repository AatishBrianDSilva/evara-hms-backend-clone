import { APIGatewayProxyHandler } from 'aws-lambda';

import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import formatPaginationResult from '@evara-backend/core/src/lib/utils/formatPaginationResult';

import { IPaginateOptions } from '@evara-backend/core/src/lib/types/pagination';
import Donor from '@evara-backend/core/models/mastersDashboard/local/Donor';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    // Connect to MongoDB
    await connectMongoDb();

    // Extract query string parameters
    const params = event.queryStringParameters || {};
    const isAdmin = JSON.parse(params.isAdmin || 'false');
    const isActive = JSON.parse(params.active || 'false');

    const {
      startDate,
      endDate,
      page = '1',
      limit = '10',
      searchQuery = '',
    } = params;

    const paginate = JSON.parse(params.paginate || 'false');

    let query: any = {};

    if (!isAdmin) {
      query.isActive = isActive;
    }

    if (searchQuery) {
      query.$or = [
        { firstName: new RegExp(searchQuery, 'i') },
        { lastName: new RegExp(searchQuery, 'i') },
        { mobile: new RegExp(searchQuery, 'i') },
        { donorId: new RegExp(searchQuery, 'i') }, // Search by donorId
      ];
    }

    if (paginate) {
      // Construct the query object

      // Date range filter
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) {
          query.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
          query.createdAt.$lte = new Date(endDate);
        }
      }

      // Pagination options
      const options: IPaginateOptions = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        lean: true,
      };

      // Fetching the patients with pagination
      const result = await Donor.paginate(query, options);

      const { records, pagination } = formatPaginationResult(result);

      // Return success response with pagination info
      return successResponse('Donors fetched successfully', {
        records,
        pagination,
      });
    } else {
      const data = await Donor.find(query).lean();

      return successResponse('Success', { records: data });
    }
  } catch (error) {
    return errorResponse(error);
  }
};
