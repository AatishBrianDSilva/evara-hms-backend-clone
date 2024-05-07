import { APIGatewayProxyHandler } from "aws-lambda";
import bcrypt from "bcryptjs";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import { User } from "@evara-backend/core/src/models/User";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();

    return successResponse("Success");
  } catch (error) {
    return errorResponse(error);
  }
};
