import { APIGatewayProxyHandler } from "aws-lambda";
import bcrypt from "bcryptjs";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import { User } from "@evara-backend/core/src/models/User";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";
import Branch from "@evara-backend/core/src/models/mastersDashboard/global/ClinicBranches";
import Consent from "@evara-backend/core/src/models/mastersDashboard/local/Consent";
import PatientNotes from "@evara-backend/core/src/models/patientDashboard/PatientNotes";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const authorizer = extractAuthorizerDetails(event);
    if (!authorizer) {
      throw new ErrorMessage(401, "Unauthorized");
    }

    await connectMongoDb();

    if (event.pathParameters === null) {
      throw new ErrorMessage(400, "Path parameters are null");
    }

    // Safely access the id property
    const id = event.pathParameters["id"];
    if (!id) {
      throw new ErrorMessage(400, "Id is not provided");
    }

    const data = await PatientNotes.findById(id).lean();

    if (!data) {
      throw new ErrorMessage(404, "Data not found");
    }

    return successResponse("Success", data);
  } catch (error) {
    return errorResponse(error);
  }
};
