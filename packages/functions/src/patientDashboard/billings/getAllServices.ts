import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import MasterInvestigation from "@evara-backend/core/src/models/patientDashboard/investigation/MasterInvestigations";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import MedicalTest from "@evara-backend/core/src/models/patientDashboard/investigation/MedicalTests";
import Patient from "@evara-backend/core/src/models/Patients";
import MasterCryoPreservations from "@evara-backend/core/src/models/patientDashboard/cryoPreservation/MasterCryoPreservations";
import CryoPreservations from "@evara-backend/core/src/models/patientDashboard/cryoPreservation/CryoPreservations";
import MasterProcedure from "@evara-backend/core/src/models/patientDashboard/procedure/MasterProcedure";
import MedicalProcedure from "@evara-backend/core/src/models/patientDashboard/procedure/MedicalProcedure";
import MasterService from "@evara-backend/core/src/models/patientDashboard/services/MasterService";
import DefaultService from "@evara-backend/core/src/models/patientDashboard/services/DefaultService";
import MasterTreatmentCycle from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/MasterTreatmentCycle";
import DefaultTreatmentCycle from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/DefaultTreatmentCycle";
import { Document, FilterQuery, Model } from "mongoose";
import { EPatientBillingServiceType } from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling";

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

    const collections = [
      { model: MasterInvestigation, path: "test", sort: "testType" },
      {
        model: MasterCryoPreservations,
        path: "cryoPreservation",
        sort: "procedureType",
      },
      { model: MasterProcedure, path: "procedure", sort: "procedureType" },
      { model: MasterService, path: "service", sort: "serviceType" },
      {
        model: MasterTreatmentCycle,
        path: "treatmentCycle",
        sort: "treatmentCycleType",
      },
    ];

    const results = await Promise.all(
      collections.map((col) => fetchData(col.model, query, col.path, col.sort))
    );

    const response = {
      [EPatientBillingServiceType.Investigation]: results[0],
      [EPatientBillingServiceType.CryoPreservation]: results[1],
      [EPatientBillingServiceType.Procedure]: results[2],
      [EPatientBillingServiceType.Service]: results[3],
      [EPatientBillingServiceType.TreatmentCycle]: results[4],
    };

    // Return success response
    return successResponse("Success", response);
  } catch (error) {
    return errorResponse(error);
  }
};

async function fetchData<T extends Document>(
  model: Model<T>,
  query: FilterQuery<T>,
  populatePath: string,
  sortField: keyof T
): Promise<T[]> {
  try {
    return await model
      .find(query)
      .populate({
        path: populatePath,
        model: model.modelName as string,
      })
      .sort({ [sortField as string]: 1 as 1 | -1 })
      .lean();
  } catch (error) {
    console.error("Failed to fetch data:", error);
    throw error; // Rethrow the error to be handled by the caller.
  }
}
