import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import Patient from "@evara-backend/core/models/Patients";
import Case from "@evara-backend/core/models/Cases";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { S3KeepPermanently, parseS3Url } from "../files/_KeepPermanently";
import { extractAuthorizerDetails } from "@evara-backend/core/lib/utils/extractAuthorizerDetails";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const auth = extractAuthorizerDetails(event);

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
    data.clinicId = auth?.clinicId;
    data.branchId = auth?.branchId;

    // TODO: Upload profile image to S3 and get the URL

    const exisitingPatient = await Patient.findOne({
      $or: [{ mobile: data.mobile }, { idProofNumber: data.idProofNumber }],
    });

    if (exisitingPatient) {
      throw new ErrorMessage(400, "Patient already exists");
    }

    // Create a new patient document
    const newPatient = new Patient(data);

    console.log("Data", data);

    if (data.image && data.image.length > 0) {
      const s3UrlParts = parseS3Url(data.image);
      // console.log("S3URLParts", s3UrlParts);
      if (s3UrlParts) {
        await S3KeepPermanently(s3UrlParts.bucketName, s3UrlParts.key);
      } else {
        throw new ErrorMessage(400, "Invalid image URL");
      }
    }

    if (data.identifications && data.identifications.length > 0) {
      for (let i = 0; i < data.identifications.length; i++) {
        if (data.identifications[i].length > 0) {
          const s3UrlParts = parseS3Url(data.identifications[i]);
          console.log(
            `Processing identification ${i + 1}: `,
            data.identifications[i]
          );
          console.log("S3URLParts", s3UrlParts);

          if (s3UrlParts) {
            await S3KeepPermanently(s3UrlParts.bucketName, s3UrlParts.key);
            console.log(
              `Successfully made permanent: ${data.identifications[i]}`
            );
          } else {
            console.error(
              `Invalid S3 URL for identification ${i + 1}: `,
              data.identifications[i]
            );

            throw new ErrorMessage(400, "Invalid image URL");
          }
        }
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
