import { APIGatewayProxyHandler } from 'aws-lambda';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/src/lib/utils/extractAuthorizerDetails';
import { fetchPatientBillingsData } from './_patientPayments';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;
  try {
    const auth = extractAuthorizerDetails(event);
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

    // Fetch paginated patient billing data (payment-wise rows)
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

    return successResponse('Success', result);
  } catch (error) {
    console.error('Error fetching patient billings', error);
    return errorResponse(error);
  }
};
