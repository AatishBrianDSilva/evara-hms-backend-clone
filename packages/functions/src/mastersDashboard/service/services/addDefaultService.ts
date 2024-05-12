import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import DefaultService from "@evara-backend/core/src/models/patientDashboard/services/DefaultService";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import { log } from "console";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    // Connect to MongoDB
    await connectMongoDb();

    if (event.body == null) {
      throw new ErrorMessage(400, "Data is required");
    }

    log("Event Body", event.body);

    // Parse the body from the event
    const data = JSON.parse(event.body);

    // Loop through the data and create a new default Service
    for (let i = 0; i < data.length; i++) {
      const test = new DefaultService(data[i]);
      await test.save();
    }

    // Return success response
    return successResponse("Test(s) Added successfully");
  } catch (error) {
    return errorResponse(error);
  }
};
