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

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    // Connect to MongoDB
    await connectMongoDb();

    let query: any = {};

    // Check if the user is an admin
    const isAdmin = event.queryStringParameters?.isAdmin === "true";

    if (!isAdmin) {
      // Standard user, apply gender filter
      query.active = true;
      query.gender = { $in: ["both"] };

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
    }

    const populate = [
      {
        path: "treatmentCycle",
        model: MasterTreatmentCycle.modelName,
      },
      {
        path: "pharmacyStock",
        model: PharmacyStock.modelName,
        populate: [
          {
            path: "item",
            model: DrugItem.modelName,
            populate: [
              {
                path: "category",
                model: DrugCategory.modelName,
              },
              {
                path: "type",
                model: DrugType.modelName,
              },
            ],
          },
        ],
      },
    ];

    // Get all treatmentCycles
    const treatmentCycles = await TreatmentCycleStage.find(query)
    .lean();

    // Return success response
    return successResponse("Success", treatmentCycles);
  } catch (error) {
    return errorResponse(error);
  }
};
