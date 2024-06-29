import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import Patients from "@evara-backend/core/models/Patients";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import Cases from "@evara-backend/core/models/Cases";
import { S3KeepPermanently, parseS3Url } from "src/files/_KeepPermanently";
import { extractAuthorizerDetails } from "@evara-backend/core/lib/utils/extractAuthorizerDetails";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const auth = extractAuthorizerDetails(event);

  const mongoose = await connectMongoDb();
  const session = await mongoose.startSession();
  try {
    // Connect to MongoDB
    if (event.pathParameters === null) {
      throw new ErrorMessage(400, "Path parameters are null");
    }

    if (event.body == null) {
      throw new ErrorMessage(400, "Partner data is required");
    }

    const id = event.pathParameters["id"];
    if (!id) {
      throw new ErrorMessage(400, "Patient Id is not provided");
    }

    session.startTransaction();

    // Parse the body from the event
    const data = JSON.parse(event.body);

    // TODO: Remove clinicId and branchId after adding authentication
    data.clinicId = auth?.clinicId;
    data.branchId = auth?.branchId;

    data.partnerId = id;

    console.log(data.partnerId);

    console.log("Data", data);

    // Create a new patient document
    const newPartner = new Patients(data);

    if (data.image && data.image.length > 0) {
      const s3UrlParts = parseS3Url(data.image);
      if (s3UrlParts) {
        await S3KeepPermanently(s3UrlParts.bucketName, s3UrlParts.key);
      } else {
        throw new ErrorMessage(400, "Invalid image URL");
      }
    }

    // Save the patient to the database
    const patient = await newPartner.save({ session });

    // Update the partnerId in the case document
    const updatedCase = await Cases.findOneAndUpdate(
      { patientId: id },
      { $set: { partnerId: patient.patientId } },
      { new: true, session }
    ).lean();

    // Update the partnerId in the patient document
    const updatedPatient = await Patients.findOneAndUpdate(
      { patientId: id },
      { $set: { partnerId: patient.patientId } },
      { new: true, session }
    ).lean();

    console.log("Patient partner", updatedPatient?.partnerId);

    // Commit the transaction
    await session.commitTransaction();

    // Return success response
    const responseData = {
      patientId: patient.patientId,
      case: updatedCase,
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
