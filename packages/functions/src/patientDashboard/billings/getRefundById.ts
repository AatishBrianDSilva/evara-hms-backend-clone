import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { PatientRefund } from "@evara-backend/core/src/models/patientDashboard/Billings/PatientRefund";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  console.log("Starting getRefundById function...");

  try {
    const { id } = event.pathParameters;
    if (!id) {
      console.error("No refund ID provided.");
      return errorResponse(new Error("Refund ID is required"), 400);
    }

    await connectMongoDb();
    console.log("MongoDB connection established.");

    const refund = await PatientRefund.findById(id);
    if (!refund) {
      console.error(`Refund not found for ID: ${id}`);
      return errorResponse(new Error("Refund not found"), 404);
    }

    console.log("Refund retrieved successfully.");

    return successResponse(refund);
  } catch (error) {
    console.error("Error occurred while fetching the refund:", error);
    return errorResponse(error);
  }
};
