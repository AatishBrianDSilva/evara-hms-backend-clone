import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import MasterCryoPreservations from "@evara-backend/core/src/models/patientDashboard/cryoPreservation/MasterCryoPreservations";

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
    const procedure = new MasterCryoPreservations(data);
    const newProcedure = await procedure.save();

    // Return success response
    return successResponse(
      "Cryo-Preservation created successfully",
      newProcedure
    );
  } catch (error) {
    return errorResponse(error);
  }
};
