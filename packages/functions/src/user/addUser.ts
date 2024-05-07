import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import { User } from "@evara-backend/core/src/models/User";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();
    // Connect to MongoDB

    console.log("Event Authorizer", event.requestContext.authorizer);
    console.log("User ID", event.requestContext.authorizer?.principalId);

    if (event.body == null) {
      throw new ErrorMessage(400, "User data is required");
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    // Here you would typically also handle authentication and validation.
    // For example, data might need to include `clinicId` and `branchId`, but
    // these should ideally be set based on the authenticated user's data.

    // Remove after authentication is implemented, and retrieve these from the user's session or token:
    data.clinicId = "EV";
    data.branchId = "KL";

    // Optionally, handle additional steps like hashing passwords or validating email uniqueness here

    const existingUser = await User.findOne({
      $or: [{ email: data.email }, { username: data.username }],
    });

    if (existingUser) {
      throw new ErrorMessage(409, "Username or email already exists");
    }

    // Create a new user document
    const newUser = new User(data);

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
