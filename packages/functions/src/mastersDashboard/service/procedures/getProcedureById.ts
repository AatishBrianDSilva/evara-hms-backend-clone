import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import MasterProcedure from "@evara-backend/core/src/models/patientDashboard/procedure/MasterProcedure";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import Patient from "@evara-backend/core/src/models/Patients";
import MedicalProcedure from "@evara-backend/core/src/models/patientDashboard/procedure/MedicalProcedure";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    // Connect to MongoDB
    await connectMongoDb();

    if (event.pathParameters === null) {
      throw new ErrorMessage(400, "Path parameters are null");
    }

    // Safely access the id property
    const id = event.pathParameters["id"];
    if (!id) {
      throw new ErrorMessage(400, "Id is not provided");
    }

    //Get all procedures
    const procedures = await MasterProcedure.findById(id)
      .populate({
        path: "procedure",
        model: MedicalProcedure.modelName,
      })
      .lean();

    // Return success response
    return successResponse("Success", procedures);
  } catch (error) {
    return errorResponse(error);
  }
};
