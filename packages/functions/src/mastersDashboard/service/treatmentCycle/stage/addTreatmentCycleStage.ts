import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import { TreatmentCycleStage } from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/TreatmentCycleStage";
import { extractAuthorizerDetails } from "@evara-backend/core/lib/utils/extractAuthorizerDetails";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const auth = extractAuthorizerDetails(event);

  try {
    // Connect to MongoDB
    await connectMongoDb();

    if (event.body == null) {
      throw new ErrorMessage(400, "Data is required");
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    // TODO: Remove clinicId and branchId after adding authentication
    data.clinicId = auth.clinicId;
    // data.branchId = "KL";

    // Create a new Master Investigation
    const treatmentCycle = new TreatmentCycleStage(data);
    const newTreatmentCycle = await treatmentCycle.save();

    // Return success response
    return successResponse("Stage created successfully", newTreatmentCycle);
  } catch (error) {
    return errorResponse(error);
  }
};
