import { APIGatewayProxyHandler } from 'aws-lambda';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { fetchHSNReportData } from './_hsnReport';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    const params = event.queryStringParameters || {};
    const {
      page = '1',
      limit = '25',
      startDate,
      endDate,
      allData = 'false',
      searchQuery = '',
    } = params;

    const fetchAllData = allData === 'true';

    const result = await fetchHSNReportData({
      clinicId: auth.clinicId,
      branchId: auth.branchId,
      page: parseInt(page),
      limit: parseInt(limit),
      startDate,
      endDate,
      fetchAllData,
      searchQuery,
    });

    return successResponse('HSN report fetched successfully', result);
  } catch (error) {
    console.error('HSN Report API Error:', error);
    return errorResponse(error);
  }
};
