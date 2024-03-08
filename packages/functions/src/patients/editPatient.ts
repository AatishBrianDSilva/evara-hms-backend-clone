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
      throw new ErrorMessage(400, "Update data is required");
    }

    const id = event.pathParameters["id"];
    console.log("event.pathParameters", event.pathParameters);
    if (!id) {
      throw new ErrorMessage(400, "Patient Id is not provided");
    }

    session.startTransaction();

    // Parse the body from the event
    const body = JSON.parse(event.body);

    const patientId = body.patientId;
    const updateData = body.values;

    const age =
      new Date().getFullYear() - new Date(updateData.dob).getFullYear();
    updateData.age = age;

    const updatedPatient = await Patients.findOneAndUpdate(
      { patientId: patientId },
      { $set: updateData },
      { new: true, session, runValidators: true } // Return the updated document and run schema validators
    ).lean();

    if (!updatedPatient) {
      throw new ErrorMessage(404, "Patient not found");
    }

    // Commit the transaction
    await session.commitTransaction();

    // Return success response with updated patient data
    return successResponse("Patient updated successfully", updatedPatient);
  } catch (error) {
    // Rollback the transaction
    await session.abortTransaction();
    return errorResponse(error);
  } finally {
    // End the session
    session.endSession();
  }
};
