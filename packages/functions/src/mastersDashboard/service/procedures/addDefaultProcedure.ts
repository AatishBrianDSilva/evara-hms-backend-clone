import { APIGatewayProxyHandler } from 'aws-lambda';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import MedicalProcedure from '@evara-backend/core/src/models/patientDashboard/procedure/MedicalProcedure';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    // Connect to MongoDB
    await connectMongoDb();

    if (event.body == null) {
      throw new ErrorMessage(400, 'Data is required');
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    // Loop through the data and create a new Master Investigation
    for (let i = 0; i < data.length; i++) {
      const res = data[i];
      const test = new MedicalProcedure(res);
      await test.save();
    }

    // Return success response
    return successResponse('Procedures(s) Added successfully');
  } catch (error) {
    return errorResponse(error);
  }
};
