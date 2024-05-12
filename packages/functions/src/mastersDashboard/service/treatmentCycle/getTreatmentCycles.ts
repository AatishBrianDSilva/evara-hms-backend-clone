import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import Patient from "@evara-backend/core/src/models/Patients";
import DefaultTreatmentCycle from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/DefaultTreatmentCycle";
import MasterTreatmentCycle from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/MasterTreatmentCycle";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    // Connect to MongoDB
    await connectMongoDb();

    let query: any = {};

    // Check if the user is an admin
    const isAdmin = event.queryStringParameters?.isAdmin === "true";

    if (!isAdmin) {
      // Standard user, apply gender filter
      query.active = true;
      query.gender = { $in: ["both"] };

      const patientId = event.queryStringParameters?.patientId;
      if (patientId) {
        const patient = await Patient.findOne({ patientId }).lean();
        if (!patient) {
          throw new ErrorMessage(404, "Patient not found");
        }
        query.gender = {
          $in: [patient.gender.toLowerCase(), "both"],
        };
      }
    }

    // Get all treatmentCycles
    const treatmentCycles = await MasterTreatmentCycle.find(query)
      .populate({
        path: "treatmentCycle",
        model: DefaultTreatmentCycle.modelName,
      })
      .sort({ treatmentCycleType: 1 })
      .lean();

    // Return success response
    return successResponse("Success", treatmentCycles);
  } catch (error) {
    return errorResponse(error);
  }
};
