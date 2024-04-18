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

    if (event.body == null) {
      throw new ErrorMessage(400, "Data is required");
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    data.clinicId = "EV";
    data.branchId = "KL";

    if (!data.patientCode) {
      throw new ErrorMessage(400, "Missing required patient history fields");
    }

    const patient = await Patient.findOne({
      patientCode: data.patientCode,
    }).lean();
    if (!patient) {
      throw new ErrorMessage(404, "Patient not found");
    }

    const existingHistory = await PatientHistory.findOne({
      patientId: patient._id,
    });
    if (existingHistory) {
      throw new ErrorMessage(409, "Patient history already exists");
    }

    // Create a new patient history
    const patientHistory = new PatientHistory({
      patientId: patient._id,
      patientCode: data.patientCode,
      clinicId: data.clinicId,
      branchId: data.branchId,
      medicalHistory: data.medicalHistory,
      menstrualAndOvulationHistory: data.menstrualAndOvulationHistory,
      coitalHistory: data.coitalHistory,
      diseaseAdverseEffect: data.diseaseAdverseEffect,
      otherFactorsAdverseEffect: data.otherFactorsAdverseEffect,
      generalPhysicalExamination: data.generalPhysicalExamination,
      investigations: data.investigations,
      summary: data.summary,
      files: data.files,
    });

    // Save the history
    await patientHistory.save();

    // Return success response
    return successResponse("History created successfully");
  } catch (error) {
    return errorResponse(error);
  }
};
