import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/errorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import MasterProcedures from "@evara-backend/core/src/models/procedure/MasterProcedure";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    // Connect to MongoDB
    await connectMongoDb();

    if (event.body == null) {
      throw new ErrorMessage(400, "Data is required");
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    // TODO: Remove clinicId and branchId after adding authentication
    data.clinicId = "EV";
    data.branchId = "KL";

    // Create a new Master Investigation
    const procedure = new MasterProcedures(data);
    const newProcedure = await procedure.save();

    // Return success response
    return successResponse("Procedure created successfully", newProcedure);
  } catch (error) {
    return errorResponse(error);
  }
};
