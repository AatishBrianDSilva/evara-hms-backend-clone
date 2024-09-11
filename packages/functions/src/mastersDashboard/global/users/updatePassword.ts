import { APIGatewayProxyHandler } from "aws-lambda";
import bcrypt from "bcryptjs";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import { User } from "@evara-backend/core/src/models/User";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb();

    if (!event.body) {
      throw new ErrorMessage(400, "Request body is required");
    }

    const { email, currentPassword, newPassword } = JSON.parse(event.body);

    if (!email || !currentPassword || !newPassword) {
      throw new ErrorMessage(
        400,
        "Missing parameters: email, currentPassword, or newPassword"
      );
    }

    const user = await User.findOne({ email });
    if (!user) {
      throw new ErrorMessage(404, "User not found");
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new ErrorMessage(401, "Current password is incorrect");
    }

    // Set new password
    user.password = await bcrypt.hash(newPassword, 8);
    await user.save();

    return successResponse("Password updated successfully", {
      userId: user._id,
    });
  } catch (error) {
    return errorResponse(error);
  }
};
