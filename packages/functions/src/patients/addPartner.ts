import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import Patients from "@evara-backend/core/models/Patients";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/lib/utils/successResponse";
import ErrorMessage from "@evara-backend/core/lib/utils/errorMessage";
import Cases from "@evara-backend/core/models/Cases";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
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
    data.clinicId = "EV";
    data.branchId = "KL";

    data.age = new Date().getFullYear() - new Date(data.dob).getFullYear();
    data.partnerId = id;

    console.log(data.age, data.partnerId);
    // TODO: Upload profile image to S3 and get the URL

    // Create a new patient document
    const newPartner = new Patients(data);

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
