import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import { fetchStockData } from './__fetchStockData';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);

    await connectMongoDb();

    const params = event.queryStringParameters || {};
    const { page = '1', limit = '25', search = '' } = params;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    // Fetch data using the reusable function
    const { records, totalDocs } = await fetchStockData({
      clinicId: auth.clinicId,
      branchId: auth.branchId,
      search,
      page: pageNumber,
      limit: limitNumber,
      fetchAllData: false,
    });

    // Calculate the starting serial number based on the page and limit
    const startSlNo = (pageNumber - 1) * limitNumber + 1;

    // Add Sl.no to each record
    records.forEach((record: any, index: number) => {
      record['id'] = startSlNo + index;
    });

    // Return the response
    const paginatedResult = {
      records,
      pagination: {
        totalDocs,
        page: pageNumber,
        limit: limitNumber,
      },
    };

    return successResponse(
      'Stock Report fetched successfully',
      paginatedResult,
    );
  } catch (error) {
    console.error('Error in stockReport API: ', error);
    return errorResponse(error);
  }
};
