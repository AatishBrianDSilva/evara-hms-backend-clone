import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { PatientRefund } from "@evara-backend/core/src/models/patientDashboard/Billings/PatientRefund";

export const main: APIGatewayProxyHandler = async (_event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  console.log("Starting getRefund function...");

  try {
    await connectMongoDb();
    console.log("MongoDB connection established.");

    const refunds = await PatientRefund.find({});
    console.log("Refunds retrieved successfully.", refunds);

    return successResponse(refunds);
  } catch (error) {
    console.error("Error occurred while fetching refunds:", error);
    return errorResponse(error);
  }
};
