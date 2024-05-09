import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import Patient from "@evara-backend/core/src/models/Patients";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    // Connect to MongoDB
    if (event.pathParameters === null) {
      throw new ErrorMessage(400, "Path parameters are null");
    }

    // Safely access the id property
    const id = event.pathParameters["id"];
    if (!id) {
      throw new ErrorMessage(400, "Id is not provided");
    }
    // Parse the body from the event
    await Patient.findByIdAndUpdate(id, {
      status: "inactive",
    });
    return successResponse("Success");
  } catch (error) {
    return errorResponse(error);
  }
};
