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

    if (event.pathParameters === null) {
      throw new ErrorMessage(400, "Path parameters are null");
    }

    // Safely access the id property
    const id = event.pathParameters["id"];
    if (!id) {
      throw new ErrorMessage(400, "Id is not provided");
    }

    if (!event.body) {
      throw new ErrorMessage(400, "Data is required");
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    // Retrieve the patient using the patientCode to find the correct patientId
    const patient = await Patient.findOne({
      patientId: id,
    }).lean();
    if (!patient) {
      throw new ErrorMessage(404, "Patient not found");
    }

    // Retrieve existing history for updates
    const patientHistory = await PatientHistory.findOne({
      patientId: patient._id,
    });
    if (!patientHistory) {
      throw new ErrorMessage(404, "Patient history not found");
    }

    // Update the patient history with new data
    patientHistory.medicalHistory =
      data.medicalHistory || patientHistory.medicalHistory;
    patientHistory.menstrualAndOvulationHistory =
      data.menstrualAndOvulationHistory ||
      patientHistory.menstrualAndOvulationHistory;
    patientHistory.coitalHistory =
      data.coitalHistory || patientHistory.coitalHistory;
    patientHistory.diseaseAdverseEffect =
      data.diseaseAdverseEffect || patientHistory.diseaseAdverseEffect;
    patientHistory.otherFactorsAdverseEffect =
      data.otherFactorsAdverseEffect ||
      patientHistory.otherFactorsAdverseEffect;
    patientHistory.generalPhysicalExamination =
      data.generalPhysicalExamination ||
      patientHistory.generalPhysicalExamination;
    patientHistory.investigations =
      data.investigations || patientHistory.investigations;
    patientHistory.summary = data.summary || patientHistory.summary;
    patientHistory.files = data.files || patientHistory.files;

    // Save the updated history
    await patientHistory.save();

    // Return success response
    return successResponse("Patient history updated successfully");
  } catch (error) {
    return errorResponse(error);
  }
};
