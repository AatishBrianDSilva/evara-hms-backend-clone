import { APIGatewayProxyHandler } from 'aws-lambda';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import { fetchPatientBillingsData } from './__patientBillings';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;
  const auth = extractAuthorizerDetails(event);

  try {
    const params = event.queryStringParameters || {};
    const {
      page = '1',
      limit = '10',
      status,
      paymentMethod,
      searchQuery = '',
      startDate,
      endDate,
      billType,
    } = params;

    // Fetch data using the reusable function
    const result = await fetchPatientBillingsData({
      clinicId: auth.clinicId,
      branchId: auth.branchId,
      page: Number(page),
      limit: Number(limit),
      status,
      paymentMethod,
      searchQuery,
      startDate,
      endDate,
      billType,
      fetchAllData: false,
    });

    // Return success response with paginated data and summary
    return successResponse('Success', result);
  } catch (error) {
    // Handle errors and return error response
    console.error('Error fetching patient billings', error);
    return errorResponse(error);
  }
};
