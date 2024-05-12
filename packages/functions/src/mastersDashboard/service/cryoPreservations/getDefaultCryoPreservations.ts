import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import CryoPreservations from "@evara-backend/core/src/models/patientDashboard/cryoPreservation/CryoPreservations";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    // Connect to MongoDB
    await connectMongoDb();

    //Get all defaults
    const defaults = await CryoPreservations.find().lean();

    // Return success response
    return successResponse("Success", defaults);
  } catch (error) {
    return errorResponse(error);
  }
};
