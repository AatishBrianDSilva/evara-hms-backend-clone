import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import Patient from "@evara-backend/core/models/Patients";
import Case from "@evara-backend/core/models/Cases";
import errorMessage from "@evara-backend/core/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/lib/utils/successResponse";
import mongoose from "mongoose";

// Handler function
// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  const mongoose = await connectMongoDb();
  const session = await mongoose.startSession();
  try {
    // Connect to MongoDB

    session.startTransaction();

    if (event.body == null) {
      throw new errorMessage(400, "Patient data is required");
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    // TODO: Remove clinicId and branchId after adding authentication
    data.clinicId = "EV";
    data.branchId = "KL";

    // TODO: Upload profile image to S3 and get the URL

    // Create a new patient document
    const newPatient = new Patient(data);

    // Save the patient to the database
    const patient = await newPatient.save({ session });

    // Generate case for the patient
    const newCase = new Case({
      patientId: patient.patientId,
    });

    const caseData = await newCase.save({ session });

    // Commit the transaction
    await session.commitTransaction();

    // Return success response
    const responseData = {
      patientId: patient.patientId,
      caseId: caseData.caseId,
    };
    return successResponse("Patient added successfully", responseData);
  } catch (error) {
    // Rollback the transaction
    await session.abortTransaction();
    return errorResponse(error);
  } finally {
    // End the session
    session.endSession();
  }
};
