import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";
import Doctors from "@evara-backend/core/src/models/mastersDashboard/Doctors";

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

    const doctor = await Doctors.findById(id);

    if (!doctor) {
      throw new ErrorMessage(404, "Doctor not found");
    }

    return successResponse("Success", doctor);
  } catch (error) {
    return errorResponse(error);
  }
};
