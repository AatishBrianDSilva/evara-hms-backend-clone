import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { IPaginateOptions } from "@evara-backend/core/src/lib/types/pagination";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import Doctors from "@evara-backend/core/src/models/mastersDashboard/Doctors";
import mongoose from "mongoose";
import Patient from "@evara-backend/core/src/models/Patients";
import PatientTreatmentCycle from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/PatientTreatmentCycle";
import DefaultTreatmentCycle from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/DefaultTreatmentCycle";
import MasterTreatmentCycle from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/MasterTreatmentCycle";
import { log } from "console";
import { extractAuthorizerDetails } from "@evara-backend/core/lib/utils/extractAuthorizerDetails";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const auth = extractAuthorizerDetails(event);
  try {
    // Connect to MongoDB
    await connectMongoDb();

    // Extract query string parameters
    const params = event.queryStringParameters || {};
    const { ...filters } = params;

    // Construct the query object
    let query: any = {
      clinicId: auth.clinicId,
      branchId: auth.branchId,
    };
    if (params.doctor) {
      query.doctor = new mongoose.Types.ObjectId(params.doctor);
    }
    if (params.patientCode) {
      query.patientCode = params.patientCode;
    }

    if (filters.treatmentCycleId) {
      query._id = new mongoose.Types.ObjectId(filters.treatmentCycleId);
    }

    // Construct the sort object
    let sort: any = {};
    if (params.sort) {
      sort = JSON.parse(params.sort);
    }

    const patient = await Patient.findOne({
      patientId: params.patientCode,
    }).lean();
    if (!patient) {
      throw new ErrorMessage(404, "Patient not found");
    }

    // Fetching the appointments without pagination
    const records = await PatientTreatmentCycle.find(query)
      .sort(sort)
      .populate([
        {
          path: "doctor",
          model: Doctors.modelName,
        },
        {
          path: "cycle",
          model: MasterTreatmentCycle.modelName,
          populate: {
            path: "treatmentCycle",
            model: DefaultTreatmentCycle.modelName,
          },
        },
      ])
      .lean();

    return successResponse("Success", records);
  } catch (error) {
    return errorResponse(error);
  }
};
