import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "../../../../core/src/lib/utils/errorResponse";
import ErrorMessage from "../../../../core/src/lib/utils/errorMessage";
import successResponse from "../../../../core/src/lib/utils/successResponse";
import MasterInvestigation from "../../../../core/src/models/investigation/MasterInvestigations";
import { connectMongoDb } from "../../../../core/src/lib/db/mongodb";
import MedicalTest from "../../../../core/src/models/investigation/MedicalTests";
import Patient from "../../../../core/src/models/Patients";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    // Connect to MongoDB
    await connectMongoDb();

    const query = {
      active: true,
      gender: {
        $in: ["both"],
      },
    };

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

    // TODO: Remove clinicId and branchId after adding authentication
    // data.clinicId = "EV";
    // data.branchId = "KL";

    //Get all investigations
    const investigations = await MasterInvestigation.find(query)
      .populate({
        path: "test",
        model: MedicalTest.modelName,
      })
      .sort({ testType: 1 })
      .lean();

    // Return success response
    return successResponse("Success", investigations);
  } catch (error) {
    return errorResponse(error);
  }
};
