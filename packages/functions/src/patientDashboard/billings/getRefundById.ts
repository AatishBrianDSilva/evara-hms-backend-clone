import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { PatientRefund } from "@evara-backend/core/src/models/patientDashboard/Billings/PatientRefund";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  console.log("Starting getRefundById function...");

  try {
    const id = event.pathParameters?.id;
    if (!id) {
      console.error("No refund ID provided.");
      // TODO: Handle this error more gracefully
      // return errorResponse(new Error("Refund ID is required"), 400);
      throw new ErrorMessage(400, "Refund ID is required");
    }

    await connectMongoDb();
    console.log("MongoDB connection established.");

    const refund = await PatientRefund.findById(id);
    if (!refund) {
      console.error(`Refund not found for ID: ${id}`);
      // return errorResponse(new Error("Refund not found"), 404);
      throw new ErrorMessage(404, "Refund not found");
    }

    console.log("Refund retrieved successfully.");

    return successResponse(refund);
  } catch (error) {
    console.error("Error occurred while fetching the refund:", error);
    return errorResponse(error);
  }
};
