import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "../../../../core/src/lib/utils/errorResponse";
import ErrorMessage from "../../../../core/src/lib/utils/errorMessage";
import successResponse from "../../../../core/src/lib/utils/successResponse";
import MasterInvestigation from "../../../../core/src/models/MasterInvestigations";
import { connectMongoDb } from "../../../../core/src/lib/db/mongodb";
import MedicalTest from "../../../../core/src/models/MedicalTests";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    // Connect to MongoDB
    await connectMongoDb();

    // TODO: Remove clinicId and branchId after adding authentication
    // data.clinicId = "EV";
    // data.branchId = "KL";

    //Get all investigations
    const investigations = await MasterInvestigation.find({}).populate({
      path: "test",
      model: MedicalTest.modelName,
    });

    // Return success response
    return successResponse("Success", investigations);
  } catch (error) {
    return errorResponse(error);
  }
};
