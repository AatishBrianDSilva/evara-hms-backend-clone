import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import mongoose from "mongoose";
import { log } from "console";
import { EProcedureType } from "@evara-backend/core/src/models/patientDashboard/procedure/MedicalProcedure";
import PatientProcedures from "@evara-backend/core/src/models/patientDashboard/procedure/PatientProcedure";
import { S3KeepPermanently, parseS3Url } from "src/files/_KeepPermanently";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

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

    // log("body", body);
    // log("body.files", body.files); // Log body.files
    // log("body.result.files", body.result?.files); // Log body.result.files

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

    const existingProcedure = await PatientProcedures.findById(id);
    if (!existingProcedure) {
      throw new ErrorMessage(404, "Procedure not found");
    }

    let allFiles = existingProcedure.result.files || [];

    if (body.result.files && Array.isArray(body.result.files)) {
      allFiles = [...allFiles, ...body.result.files];
      for (const fileUrl of body.result.files) {
        const s3UrlParts = parseS3Url(fileUrl);
        if (s3UrlParts) {
          await S3KeepPermanently(s3UrlParts.bucketName, s3UrlParts.key);
        } else {
          throw new ErrorMessage(400, "Invalid image URL");
        }
      }
    } else if (body.result.files) {
      throw new ErrorMessage(400, "Invalid files array");
    }

    updateData.result.files = allFiles;

    const procedure = await PatientProcedures.findByIdAndUpdate(id, updateData, { new: true });

    return successResponse("Procedure Updated successfully", procedure);
  } catch (error) {
    return errorResponse(error);
  }
};
