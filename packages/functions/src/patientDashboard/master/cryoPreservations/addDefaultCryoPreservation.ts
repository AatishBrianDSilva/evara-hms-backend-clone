import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/errorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import CryoPreservation from "@evara-backend/core/src/models/patientDashboard/cryoPreservation/CryoPreservations";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    // Connect to MongoDB
    await connectMongoDb();

    if (event.body == null) {
      throw new ErrorMessage(400, "Data is required");
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    // Loop through the data and create a new Master Investigation
    for (let i = 0; i < data.length; i++) {
      const res = data[i];
      const test = new CryoPreservation(res);
      await test.save();
    }

    // Return success response
    return successResponse("Cryo preservation(s) Added successfully");
  } catch (error) {
    return errorResponse(error);
  }
};
