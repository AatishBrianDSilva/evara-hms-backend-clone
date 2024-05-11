import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import MedicalTest from "@evara-backend/core/src/models/patientDashboard/investigation/MedicalTests";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    // Connect to MongoDB
    await connectMongoDb();

    //Get all defaults
    const defaults = await MedicalTest.find().lean();

    // Return success response
    return successResponse("Success", defaults);
  } catch (error) {
    return errorResponse(error);
  }
};
