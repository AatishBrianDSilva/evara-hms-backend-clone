import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import Patient from "@evara-backend/core/src/models/Patients";
import MasterService from "@evara-backend/core/src/models/patientDashboard/services/MasterService";
import DefaultService from "@evara-backend/core/src/models/patientDashboard/services/DefaultService";
import { extractAuthorizerDetails } from "@evara-backend/core/lib/utils/extractAuthorizerDetails";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const auth = extractAuthorizerDetails(event);

  try {
    // Connect to MongoDB
    await connectMongoDb();

    const query: any = {
      clinicId: auth.clinicId,
    };

    const params = event.queryStringParameters || {};
    const { searchQuery = "" } = params;

    query.active = true;

    if (searchQuery) {
      query.$or = [{ name: new RegExp(searchQuery, "i") }];
    }

    const patientId = event.queryStringParameters?.patientId;

    if (patientId) {
      const patient = await Patient.findOne({ patientId }).lean();
      if (!patient) {
        throw new ErrorMessage(404, "Patient not found");
      }
    }

    // TODO: Remove clinicId and branchId after adding authentication
    // data.clinicId = "EV";
    // data.branchId = "KL";

    //Get all investigations
    const investigations = await MasterService.find(query)
      .populate({
        path: "service",
        model: DefaultService.modelName,
      })
      .sort({ serviceType: 1 })
      .lean();

    // Return success response
    return successResponse("Success", investigations);
  } catch (error) {
    return errorResponse(error);
  }
};
