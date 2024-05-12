import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";

import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import Doctors from "@evara-backend/core/src/models/mastersDashboard/Doctors";
import PatientTreatmentCycle from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/PatientTreatmentCycle";
import MasterTreatmentCycle from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/MasterTreatmentCycle";
import DefaultTreatmentCycle from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/DefaultTreatmentCycle";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb();

    if (event.pathParameters === null) {
      throw new ErrorMessage(400, "Path parameters are null");
    }

    // Safely access the id property
    const id = event.pathParameters["id"];
    if (!id) {
      throw new ErrorMessage(400, "Id is not provided");
    }

    const treatmentCycle = await PatientTreatmentCycle.findById(id)
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

    if (!treatmentCycle) {
      throw new ErrorMessage(404, "TreatmentCycle not found");
    }

    return successResponse(
      "TreatmentCycle fetched successfully",
      treatmentCycle
    );
  } catch (error) {
    return errorResponse(error);
  }
};
