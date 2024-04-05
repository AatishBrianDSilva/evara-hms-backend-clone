import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import successResponse from "@evara-backend/core/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/lib/utils/errorMessage";
import mongoose from "mongoose";
import { log } from "console";
import { EProcedureType } from "../../../core/src/models/procedure/MedicalProcedures";
import PatientProcedures from "../../../core/src/models/procedure/PatientProcedures";

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

    if (body.testType === EProcedureType.Hysteroscopy) {
      updateData.result = body.result;
      updateData.status = "Completed";
    } else if (body.testType === EProcedureType.PGT) {
      updateData.result = body.result;
      updateData.status = "Completed";
    } else if (body.testType === EProcedureType.TESA) {
      updateData.result = body.result;
      updateData.status = "Completed";
    }

    const procedure = await PatientProcedures.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    return successResponse("Procedure Updated successfully", procedure);
  } catch (error) {
    return errorResponse(error);
  }
};
