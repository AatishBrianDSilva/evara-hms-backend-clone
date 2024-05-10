import { APIGatewayProxyHandler } from "aws-lambda";
import bcrypt from "bcryptjs";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import { User } from "@evara-backend/core/src/models/User";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";
import Branch from "@evara-backend/core/src/models/mastersDashboard/global/ClinicBranches";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    const authorizer = extractAuthorizerDetails(event);
    if (!authorizer) {
      throw new ErrorMessage(401, "Unauthorized");
    }

    await connectMongoDb();

    if (!event.pathParameters || !event.pathParameters["id"]) {
      throw new ErrorMessage(400, "Invalid request");
    }
    const id = event.pathParameters["id"];

    const branch = await Branch.findById(id).lean();

    if (!branch) {
      throw new ErrorMessage(404, "branch not found");
    }

    return successResponse("Success", branch);
  } catch (error) {
    return errorResponse(error);
  }
};
