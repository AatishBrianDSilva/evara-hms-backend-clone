import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import Patient from "@evara-backend/core/models/Patients";
import errorMessage from "@evara-backend/core/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/lib/utils/successResponse";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    // Connect to MongoDB
    await connectMongoDb();

    if (event.body == null) {
      throw new errorMessage(400, "Patient data is required");
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    // Create a new patient document
    const patient = new Patient(data);

    // Save the patient to the database
    await patient.save();

    // Return success response
    const responseData = {
      patientId: patient.id,
    };
    return successResponse("Patient added successfully", responseData);
  } catch (error) {
    return errorResponse(error);
  }
};
