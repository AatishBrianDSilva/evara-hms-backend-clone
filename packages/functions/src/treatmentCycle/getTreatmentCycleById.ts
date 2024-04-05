import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";

import successResponse from "@evara-backend/core/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/lib/utils/errorMessage";
import Doctors from "@evara-backend/core/src/models/Doctors";
import PatientTreatmentCycle from "@evara-backend/core/src/models/treatmentCycle/PatientTreatmentCycle";
import MasterTreatmentCycle from "@evara-backend/core/src/models/treatmentCycle/MasterTreatmentCycle";
import DefaultTreatmentCycle from "@evara-backend/core/src/models/treatmentCycle/DefaultTreatmentCycle";

export const main: APIGatewayProxyHandler = async (event, _context) => {
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
