import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";

import successResponse from "@evara-backend/core/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/lib/utils/errorMessage";
import Doctors from "../../../core/src/models/Doctors";
import PatientProcedures from "../../../core/src/models/procedures/PatientProcedures";
import MasterProcedure from "../../../core/src/models/procedures/MasterProcedures";
import MedicalProcedure from "../../../core/src/models/procedures/MedicalProcedures";

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

    const procedure = await PatientProcedures.findById(id)
      .populate([
        {
          path: "doctor",
          select: "firstName lastName desgination",
          model: Doctors.modelName,
        },
        {
          path: "procedure",
          model: MasterProcedure.modelName,
          populate: {
            path: "procedure",
            model: MedicalProcedure.modelName,
          },
        },
      ])
      .lean();

    if (!procedure) {
      throw new ErrorMessage(404, "Procedure not found");
    }

    return successResponse("Procedure fetched successfully", procedure);
  } catch (error) {
    return errorResponse(error);
  }
};
