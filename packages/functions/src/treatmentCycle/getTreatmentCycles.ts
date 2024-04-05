import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "../../../core/src/lib/utils/errorResponse";
import ErrorMessage from "../../../core/src/lib/utils/errorMessage";
import successResponse from "../../../core/src/lib/utils/successResponse";
import { IPaginateOptions } from "../../../core/src/lib/types/pagination";
import { connectMongoDb } from "../../../core/src/lib/db/mongodb";
import Doctors from "../../../core/src/models/Doctors";
import mongoose from "mongoose";
import Patient from "../../../core/src/models/Patients";
import PatientTreatmentCycle from "../../../core/src/models/treatmentCycle/PatientTreatmentCycle";
import DefaultTreatmentCycle from "../../../core/src/models/treatmentCycle/DefaultTreatmentCycle";
import MasterTreatmentCycle from "../../../core/src/models/treatmentCycle/MasterTreatmentCycle";
import { log } from "console";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    // Connect to MongoDB
    await connectMongoDb();

    // Extract query string parameters
    const params = event.queryStringParameters || {};
    log("Params: ", params);

    // Construct the query object
    let query: any = {};
    if (params.doctor) {
      query.doctor = new mongoose.Types.ObjectId(params.doctor);
    }
    if (params.patientCode) {
      query.patientCode = params.patientCode;
    }

    // Construct the sort object
    let sort: any = {};
    if (params.sort) {
      sort = JSON.parse(params.sort);
    }

    log("Sort: ", sort);

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
