import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import {
  generateUserJwtToken,
  verifyToken,
} from "@evara-backend/core/src/lib/utils/auth";

import { User } from "@evara-backend/core/src/models/User";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();

    if (!event.body) {
      throw new ErrorMessage(400, "No data provided");
    }

    const { refreshToken } = JSON.parse(event.body);
    if (!refreshToken) {
      throw new ErrorMessage(400, "Refresh token is required");
    }

    // Verify the refresh token
    const decoded = await verifyToken(refreshToken, true);
    if (!decoded) {
      throw new ErrorMessage(401, "Invalid refresh token");
    }

    // Find the user based on the decoded user ID (sub in JWT)
    const user = await User.findById(decoded.sub);
    if (!user) {
      throw new ErrorMessage(404, "User not found");
    }

    // Generate new JWT token
    const tokens = await generateUserJwtToken(user);

    return successResponse("Token refreshed successfully", tokens);
  } catch (error) {
    return errorResponse(error);
  }
};
