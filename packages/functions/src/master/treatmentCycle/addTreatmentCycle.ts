import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "../../../../core/src/lib/utils/errorResponse";
import ErrorMessage from "../../../../core/src/lib/utils/errorMessage";
import successResponse from "../../../../core/src/lib/utils/successResponse";
import { connectMongoDb } from "../../../../core/src/lib/db/mongodb";
import MasterTreatmentCycle from "../../../../core/src/models/treatmentCycle/MasterTreatmentCycle";

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
    const treatmentCycle = new MasterTreatmentCycle(data);
    const newTreatmentCycle = await treatmentCycle.save();

    // Return success response
    return successResponse(
      "TreatmentCycle created successfully",
      newTreatmentCycle
    );
  } catch (error) {
    return errorResponse(error);
  }
};
