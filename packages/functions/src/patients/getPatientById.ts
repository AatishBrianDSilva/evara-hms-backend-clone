import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";

import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import Patient from "@evara-backend/core/models/Patients";
import Cases from "@evara-backend/core/models/Cases";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb();

    if (event.pathParameters === null) {
      throw new ErrorMessage(400, "Path parameters are null");
    }

    // Safely access the id property
    const id = event.pathParameters["id"];
    if (!id) {
      throw new ErrorMessage(400, "Id is not provided");
    }

    const patient = await Patient.findOne({ patientId: id });

    if (!patient) {
      throw new ErrorMessage(404, "Patient not found");
    }

    const patientCase = await Cases.findOne({
      $or: [{ patientId: id }, { partnerId: id }],
    });
    const partner = await Patient.findOne({ patientId: patient.partnerId });

    const result = {
      patient,
      case: patientCase,
      partner,
    };
    return successResponse("Patient fetched successfully", result);
  } catch (error) {
    return errorResponse(error);
  }
};
