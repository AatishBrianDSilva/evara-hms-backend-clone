import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/errorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import DefaultTreatmentCycle from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/DefaultTreatmentCycle";
import { log } from "console";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    // Connect to MongoDB
    await connectMongoDb();

    if (event.body == null) {
      throw new ErrorMessage(400, "Data is required");
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);
    log("Data", data);

    // Loop through the data and create a new Master Investigation
    for (let i = 0; i < data.length; i++) {
      const res = data[i];
      log("Res", res);
      const test = new DefaultTreatmentCycle(res);
      await test.save();
    }

    // Return success response
    return successResponse("TreatmentCycles(s) Added successfully");
  } catch (error) {
    return errorResponse(error);
  }
};
