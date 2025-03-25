import { APIGatewayProxyHandler } from 'aws-lambda';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { fetchB2CReportData } from './_b2cReport';

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

    const result = await fetchB2CReportData({
      clinicId: auth.clinicId,
      branchId: auth.branchId,
      page: parseInt(page),
      limit: parseInt(limit),
      startDate,
      endDate,
      fetchAllData,
      searchQuery,
    });

    return successResponse('B2C report fetched successfully', result);
  } catch (error) {
    console.error('B2C Report API Error:', error);
    return errorResponse(error);
  }
};
