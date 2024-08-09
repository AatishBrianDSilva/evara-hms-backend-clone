import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import Patient from "@evara-backend/core/src/models/Patients";
import DefaultTreatmentCycle from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/DefaultTreatmentCycle";
import MasterTreatmentCycle from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/MasterTreatmentCycle";
import { PharmacyStock } from "@evara-backend/core/src/models/pharmacyDashboard/PharmacyStock";
import { DrugItem } from "@evara-backend/core/src/models/pharmacyDashboard/DrugItem";
import { DrugCategory } from "@evara-backend/core/src/models/pharmacyDashboard/DrugCategory";
import { DrugType } from "@evara-backend/core/src/models/pharmacyDashboard/DrugType";
import { TreatmentCycleConsumable } from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/TreatmentCycleConsumable";
import { TreatmentCycleStage } from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/TreatmentCycleStage";
import { extractAuthorizerDetails } from "@evara-backend/core/lib/utils/extractAuthorizerDetails";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const auth = extractAuthorizerDetails(event);

  try {
    // Connect to MongoDB
    await connectMongoDb();

    // Get all treatmentCycles
    const treatmentCycles = await TreatmentCycleStage.find({
      clinicId: auth.clinicId,
    }).lean();

    // Return success response
    return successResponse("Success", treatmentCycles);
  } catch (error) {
    return errorResponse(error);
  }
};
