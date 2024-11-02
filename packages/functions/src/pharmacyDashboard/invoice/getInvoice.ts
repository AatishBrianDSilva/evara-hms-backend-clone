import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { PharmacyInvoice } from '@evara-backend/core/models/pharmacyDashboard/PharmacyInvoice';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;
  const auth = extractAuthorizerDetails(event);

  try {
    await connectMongoDb();

    const invoices = await PharmacyInvoice.find({
      clinicId: auth.clinicId,
      branchId: auth.branchId,
    }).lean();

    return successResponse('Fetched invoices successfully', invoices);
  } catch (error) {
    return errorResponse(error);
  }
};
