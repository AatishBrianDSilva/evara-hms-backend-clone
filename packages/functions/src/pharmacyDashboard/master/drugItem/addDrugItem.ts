import { APIGatewayProxyHandler } from 'aws-lambda';

import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import {
  DrugItem,
  IDrugItem,
} from '@evara-backend/core/models/pharmacyDashboard/DrugItem';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const auth = extractAuthorizerDetails(event);

  try {
    if (auth.clinicId == null) {
      throw new ErrorMessage(400, 'Clinic ID is required');
    }
    await connectMongoDb();

    if (event.body == null) {
      throw new ErrorMessage(400, 'Data is required');
    }

    const data: IDrugItem = JSON.parse(event.body);
    data.clinicId = auth.clinicId;

    await DrugItem.create(data);

    return successResponse('Drug item added successfully');
  } catch (error) {
    return errorResponse(error);
  }
};
