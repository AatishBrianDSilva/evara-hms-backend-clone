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

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    // Connect to MongoDB
    await connectMongoDb();

    // Extract query string parameters
    const params = event.queryStringParameters || {};
    const { ...filters } = params;

    // Construct the query object
    let query: any = {};

    // Pagination options
    const options: IPaginateOptions = {
      lean: true,
    };

    //Add populate fields
    options.populate = [
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
    ];

    if (filters.doctor) {
      query.doctor = new mongoose.Types.ObjectId(filters.doctor);
    }

    if (filters.patientCode) {
      query.patientCode = filters.patientCode;
    }

    const patient = await Patient.findOne({
      patientId: filters.patientCode,
    }).lean();
    if (!patient) {
      throw new ErrorMessage(404, "Patient not found");
    }

    // Fetching the appointments without pagination
    const records = await PatientTreatmentCycle.find(query).lean();

    return successResponse("Success", {
      records,
    });
  } catch (error) {
    return errorResponse(error);
  }
};
