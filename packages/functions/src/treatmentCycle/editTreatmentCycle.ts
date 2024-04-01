import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import successResponse from "@evara-backend/core/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/lib/utils/errorMessage";
import mongoose from "mongoose";
import { log } from "console";
import PatientTreatmentCycle from "../../../core/src/models/treatmentCycle/PatientTreatmentCycle";
import { ETreatmentCycleType } from "../../../core/src/models/treatmentCycle/DefaultTreatmentCycle";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();

    if (!event.pathParameters) {
      throw new ErrorMessage(400, "Path parameters are null");
    }

    const id = event.pathParameters["id"];
    if (!id) {
      throw new ErrorMessage(400, "Id is not provided");
    }

    if (!event.body) {
      throw new ErrorMessage(400, "Data is required");
    }

    const body = JSON.parse(event.body);
    log("body", body);
    const updateData: any = {};

    if (body.date) {
      updateData.date = body.date;
    }
    if (body.doctor) {
      updateData.doctor = new mongoose.Types.ObjectId(body.doctor);
    }

    if (body.status) {
      updateData.status = body.status;
    }
    updateData.status = "Completed";

    if (body.testType === ETreatmentCycleType.IUI) {
      updateData.result = body.result;
    } else if (body.testType === ETreatmentCycleType.OITI) {
      updateData.result = body.result;
    } else if (body.testType === ETreatmentCycleType.ICSIPlusDonorEgg) {
      updateData.result = body.result;
    }

    const treatmentCycle = await PatientTreatmentCycle.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    return successResponse(
      "TreatmentCycle Updated successfully",
      treatmentCycle
    );
  } catch (error) {
    return errorResponse(error);
  }
};
