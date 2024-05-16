import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import Patient from "@evara-backend/core/models/Patients";
import Case from "@evara-backend/core/models/Cases";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { S3KeepPermanently, parseS3Url } from "../files/_KeepPermanently";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const mongoose = await connectMongoDb();
  const session = await mongoose.startSession();
  try {
    // Connect to MongoDB

    session.startTransaction();

    if (event.body == null) {
      throw new ErrorMessage(400, "Patient's data is required");
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    // TODO: Remove clinicId and branchId after adding authentication
    data.clinicId = "EV";
    data.branchId = "KL";

    // TODO: Upload profile image to S3 and get the URL

    // Create a new patient document
    const newPatient = new Patient(data);

    if (data.image) {
      const s3UrlParts = parseS3Url(data.image);
      if (s3UrlParts) {
        await S3KeepPermanently(s3UrlParts.bucketName, s3UrlParts.key);
      } else {
        throw new ErrorMessage(400, "Invalid image URL");
      }
    }

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
