import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import { User } from "@evara-backend/core/src/models/User";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";
import bcrypt from "bcrypt";
// Handler function
export const main: APIGatewayProxyHandler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb();
    // Connect to MongoDB
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, "Unauthorized");
    }

    if (event.body == null) {
      throw new ErrorMessage(400, "User data is required");
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    data.clinicId = auth?.clinicId;

    const existingUser = await User.findOne({
      $or: [{ email: data.email }, { username: data.username }],
    });

    if (existingUser) {
      throw new ErrorMessage(409, "Username or email already exists");
    }

    // Create a new user document
    const newUser = new User(data);

    newUser.password = await bcrypt.hash(data.password, 8);

    // Save the user to the database
    const user = await newUser.save();

    // Return success response
    const responseData = {
      userId: user._id,
      username: user.username,
      email: user.email,
    };
    return successResponse("User added successfully", responseData);
  } catch (error) {
    return errorResponse(error);
  }
};
