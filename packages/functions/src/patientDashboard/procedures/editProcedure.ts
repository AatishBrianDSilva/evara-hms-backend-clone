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
import SNSService from "@evara-backend/core/lib/aws/sns";
import {
  EBuckets,
  EDocumentTypes,
  EReportTemplateTypes,
  IReportData,
} from "@evara-backend/core/lib/types/global";
import { generateSections } from "@evara-backend/core/lib/utils/sanitizeReportData";
import _ from "lodash";

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
    } else if (body.testType === EProcedureType.Laparoscopy) {
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

    if (body.result?.files && body.result?.files.length > 0) {
      for (let i = 0; i < body.result.files.length; i++) {
        if (body.result.files[i].length > 0) {
          const s3UrlParts = parseS3Url(body.result.files[i]);
          if (s3UrlParts) {
            await S3KeepPermanently(s3UrlParts.bucketName, s3UrlParts.key);
          } else {
            throw new ErrorMessage(400, "Invalid image URL");
          }
        }
      }
    }

    const procedure = await PatientProcedures.findByIdAndUpdate(id, updateData, { new: true });

    console.log("Procedure Updated successfully", JSON.stringify(procedure, null, 2));

    // Generate Report if investigation is completed
    if (procedure && procedure.status === "Completed") {
      const report = processDataForReport(procedure);
      console.log("Report Data: ", JSON.stringify(report, null, 2));

      // Send to SNS
      await SNSService.publishMessage({
        Message: JSON.stringify(report),
        TopicArn: process.env.REPORT_HTML_GENERATION_TOPIC_ARN,
      });
    }

    return successResponse("Procedure Updated successfully", procedure);
  } catch (error) {
    return errorResponse(error);
  }
};

const processDataForReport = (data: any) => {
  const reportData: IReportData = {
    bucket: EBuckets.UserReports,
    documentType: EDocumentTypes.Procedure,
    templateType: EReportTemplateTypes.Reports,
    doctor: data.doctor.firstName + " " + data.doctor.lastName,
    patient: data.patient,
    clinic: data.clinicId,
    sections: [],
    reportName: "",
    fileName: _.kebabCase(data.result.procedureName),
    reportId: data._id,
  };

  reportData.reportName = `${data.result.procedureName} Report`;
  reportData.sections = [...generateSections(data.result.details)];

  if (data.result.notes) {
    reportData.sections.push({
      showTitle: true,
      title: "Notes",
      content: {
        Notes: data.result.notes,
      },
    });
  }

  return reportData;
};
