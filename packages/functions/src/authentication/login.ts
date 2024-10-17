import { APIGatewayProxyHandler } from "aws-lambda";
import bcrypt from "bcryptjs";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import { generateUserJwtToken } from "@evara-backend/core/src/lib/utils/auth";

import { EUserRole, User } from "@evara-backend/core/src/models/User";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb();

    if (!event.body) {
      throw new ErrorMessage(400, "No data provided");
    }

    const { email, password, clinicId, branchId } = JSON.parse(event.body);
    if (!email || !password || !clinicId || !branchId) {
      throw new ErrorMessage(
        400,
        "Please provide email, password, clinicId and branchId"
      );
    }

    // Include clinicId and in the search query
    const user = await User.findOne({
      email,
      clinicId,
    }).lean();

    if (!user) {
      throw new ErrorMessage(404, "User not found");
    }

    if (user.role !== EUserRole.Admin && user.branchId !== branchId) {
      throw new ErrorMessage(
        400,
        "You don't have permission to access this branch"
      );
    }

    if (user.role === EUserRole.Admin) {
      user.branchId = branchId;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new ErrorMessage(400, "Invalid credentials");
    }

    const tokens = await generateUserJwtToken(user);

    return successResponse("Login successful", {
      tokens,
    });
  } catch (error) {
    return errorResponse(error);
  }
};
