import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";
import { APIGatewayProxyHandler } from "aws-lambda";
import { IDateRange } from "./summary";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import Appointments from "@evara-backend/core/src/models/Appointments";
import Patient from "@evara-backend/core/src/models/Patients";
import Donor from "@evara-backend/core/src/models/mastersDashboard/local/Donor";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, "Unauthorized");
    }
    // Connect to MongoDB
    await connectMongoDb();

    // Extract query string parameters
    const params = event.queryStringParameters || {};
    const { startDate, endDate } = params;
    // console.log("New Params", params);

    const dateRange: IDateRange = {
      startDate: new Date(),
      endDate: new Date(),
    };

    if (startDate) {
      dateRange.startDate = new Date(startDate);
    }
    if (endDate) {
      dateRange.endDate = new Date(endDate);
    }

    const patients = await Patient.find({
      clinicId: auth.clinicId,
      branchId: auth.branchId,
      createdAt: {
        $gte: dateRange.startDate,
        $lte: dateRange.endDate,
      },
    });

    const donorsCreated = await Donor.countDocuments({
      clinicId: auth.clinicId,
      branchId: auth.branchId,
      createdAt: {
        $gte: dateRange.startDate,
        $lte: dateRange.endDate,
      },
    });

    const response = {
      patientCount: patients.length,
      donorsCount: donorsCreated,
      patients: patients,
    };

    return successResponse("Success", response);
  } catch (error) {
    return errorResponse(error);
  }
};
