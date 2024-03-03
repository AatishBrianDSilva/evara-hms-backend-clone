import { APIGatewayProxyHandler } from "aws-lambda";

import Patient from "@evara-backend/core/models/Patients";
import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    // Connect to MongoDB
    await connectMongoDb();

    if (event.body == null) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "No patient record provided",
        }),
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Parse the body from the event
    const data = JSON.parse(event.body);

    // Create a new patient document
    const patient = new Patient(data);

    // Save the patient to the database
    await patient.save();

    // Return success response
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Patient record saved successfully",
        patientId: patient._id,
      }),
    };
  } catch (error) {
    console.error("Error saving patient record:", error);

    // Return error response
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error saving patient record",
        // error: error.message,
      }),
    };
  }
};
