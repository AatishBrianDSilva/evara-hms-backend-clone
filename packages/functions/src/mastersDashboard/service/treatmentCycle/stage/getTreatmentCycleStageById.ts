import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import Patient from "@evara-backend/core/src/models/Patients";
import DefaultTreatmentCycle from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/DefaultTreatmentCycle";
import MasterTreatmentCycle from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/MasterTreatmentCycle";
import { TreatmentCycleConsumable } from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/TreatmentCycleConsumable";
import { DrugItem } from "@evara-backend/core/src/models/pharmacyDashboard/DrugItem";
import { DrugCategory } from "@evara-backend/core/src/models/pharmacyDashboard/DrugCategory";
import { DrugType } from "@evara-backend/core/src/models/pharmacyDashboard/DrugType";
import { PharmacyStock } from "@evara-backend/core/src/models/pharmacyDashboard/PharmacyStock";
import { TreatmentCycleStage } from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/TreatmentCycleStage";

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

    console.log("id", id);

    //Get all treatmentCycles
    const treatmentCycles = await TreatmentCycleStage.findById(id).lean();

    // Return success response
    return successResponse("Success", treatmentCycles);
  } catch (error) {
    return errorResponse(error);
  }
};
