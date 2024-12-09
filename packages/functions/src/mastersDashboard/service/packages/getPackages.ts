import { APIGatewayProxyHandler } from 'aws-lambda';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import MasterPackage from '@evara-backend/core/src/models/patientDashboard/packages/MasterPackage';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const auth = extractAuthorizerDetails(event);

  try {
    // Connect to MongoDB
    await connectMongoDb();

    const params = event.queryStringParameters || {};

    const { searchQuery = '', active } = params;

    let query: any = {
      clinicId: auth.clinicId,
      branchId: auth.branchId,
    };

    if (typeof active !== 'undefined') {
      query.active = active === 'true';
    }

    if (searchQuery) {
      query.$or = [{ name: new RegExp(searchQuery, 'i') }];
    }

    const packages = await MasterPackage.find(query).sort({ name: 1 }).lean();

    return successResponse('Success', packages);
  } catch (error) {
    console.log('Error occurred during package retrieval:', error);
    return errorResponse(error);
  }
};
