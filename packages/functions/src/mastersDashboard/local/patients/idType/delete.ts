import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { User } from "@evara-backend/core/src/models/User";
import Branch from "@evara-backend/core/src/models/mastersDashboard/global/ClinicBranches";
import IDType from "@evara-backend/core/src/models/mastersDashboard/local/patients/IDType";
import { APIGatewayProxyHandler } from "aws-lambda";

// Soft delete user
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
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

    await IDType.findByIdAndDelete(id);

    return successResponse("Deleted successfully");
  } catch (error) {
    return errorResponse(error);
  }
};
