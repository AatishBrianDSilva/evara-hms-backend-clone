import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";

import successResponse from "@evara-backend/core/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/lib/utils/errorMessage";
import PatientTreatmentCycle from "../../../core/src/models/treatmentCycle/PatientTreatmentCycle";

export const main: APIGatewayProxyHandler = async (event, _context) => {
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

    const treatmentCycle = await PatientTreatmentCycle.findByIdAndDelete(id);
    console.log("TreatmentCycle", treatmentCycle);

    return successResponse(
      "TreatmentCycle Updated successfully",
      treatmentCycle
    );
  } catch (error) {
    return errorResponse(error);
  }
};
