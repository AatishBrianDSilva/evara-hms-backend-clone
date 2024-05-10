import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import Doctors from "@evara-backend/core/models/mastersDashboard/Doctors";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, "Unauthorized");
    }

    await connectMongoDb();
    // Connect to MongoDB

    if (event.body == null) {
      throw new ErrorMessage(400, "Doctor's data is required");
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    // Create a new doctor document
    const newDoctor = new Doctors(data);

    // Save the doctor to the database
    const doctor = await newDoctor.save();

    // Return success response
    const responseData = {
      doctorId: doctor._id,
    };
    return successResponse("Doctor added successfully", responseData);
  } catch (error) {
    return errorResponse(error);
  }
};
