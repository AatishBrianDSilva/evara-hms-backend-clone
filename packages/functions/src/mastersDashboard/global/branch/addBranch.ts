import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/src/lib/utils/extractAuthorizerDetails';
import Branch from '@evara-backend/core/src/models/mastersDashboard/global/ClinicBranches';

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb();
    // Connect to MongoDB
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, 'Unauthorized');
    }

    if (event.body == null) {
      throw new ErrorMessage(400, 'User data is required');
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    const existingBranch = await Branch.findOne({
      clinicId: auth.clinicId,
      code: data.code,
    });

    if (existingBranch) {
      throw new ErrorMessage(409, 'Branch code already exists');
    }

    // Create a new branch document
    const newBranch = new Branch({
      ...data,
      clinicId: auth.clinicId,
    });

    // Save the branch to the database
    const res = await newBranch.save();

    return successResponse('Branch added successfully', res);
  } catch (error) {
    return errorResponse(error);
  }
};
