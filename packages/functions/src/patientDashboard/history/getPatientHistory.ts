import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/errorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import Patient from "@evara-backend/core/src/models/Patients";
import { PatientHistory } from "@evara-backend/core/models/patientDashboard/PatientHistory";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    // Connect to MongoDB
    await connectMongoDb();

    // Extract patientCode from the query parameters
    if (event.pathParameters === null) {
      throw new ErrorMessage(400, "Path parameters are null");
    }

    // Safely access the id property
    const id = event.pathParameters["id"];
    if (!id) {
      throw new ErrorMessage(400, "Id is not provided");
    }

    // Find the patient by patientCode
    const patient = await Patient.findOne({ patientId: id }).lean();
    if (!patient) {
      throw new ErrorMessage(404, "Patient not found");
    }

    // Retrieve the patient history using patient's ID
    const patientHistory = await PatientHistory.findOne({
      patientId: patient._id,
    }).lean();
    if (!patientHistory) {
      throw new ErrorMessage(404, "Patient history not found");
    }

    // Return the patient history data
    return successResponse(
      "Patient history retrieved successfully",
      patientHistory
    );
  } catch (error) {
    return errorResponse(error);
  }
};
