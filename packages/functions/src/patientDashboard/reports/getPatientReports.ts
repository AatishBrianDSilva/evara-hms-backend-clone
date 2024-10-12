import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import Patient from "@evara-backend/core/src/models/Patients";
import PatientReports from "@evara-backend/core/models/patientDashboard/PatientReports";
import { extractAuthorizerDetails } from "@evara-backend/core/lib/utils/extractAuthorizerDetails";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const authorizer = extractAuthorizerDetails(event);
    if (!authorizer) {
      throw new ErrorMessage(401, "Unauthorized");
    }

    const patient = event.queryStringParameters?.patient;

    if (!patient) {
      throw new ErrorMessage(400, "Patient is required");
    }

    await connectMongoDb();

    const data = await PatientReports.find({
      patient: patient,
      category: { $ne: "Refund" }, // Exclude category 'Refund'
    }).sort({
      createdAt: -1,
    });

    return successResponse("Success", data);
  } catch (error) {
    return errorResponse(error);
  }
};
