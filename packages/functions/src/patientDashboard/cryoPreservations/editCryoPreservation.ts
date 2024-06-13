import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import mongoose from "mongoose";
import { log } from "console";
import CryoPreservations, {
  ECryoPreservationType,
} from "@evara-backend/core/src/models/patientDashboard/cryoPreservation/CryoPreservations";
import PatientCryoPreservation from "@evara-backend/core/src/models/patientDashboard/cryoPreservation/PatientCryoPreservation";
import { S3KeepPermanently, parseS3Url } from "src/files/_KeepPermanently";
import Doctors from "@evara-backend/core/src/models/mastersDashboard/Doctors";
import MasterCryoPreservations from "@evara-backend/core/models/patientDashboard/cryoPreservation/MasterCryoPreservations";
import SNSService from "@evara-backend/core/lib/aws/sns";
import {
  EBuckets,
  EDocumentTypes,
  EReportTemplateTypes,
  IReportData,
} from "@evara-backend/core/lib/types/global";
import {
  generateSections,
  transformBloodTestsToKeyValuePairs,
} from "@evara-backend/core/lib/utils/sanitizeReportData";
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

    if (body.testType === ECryoPreservationType.Sperm) {
      updateData.details = body.details;
      updateData.status = "Completed";
    } else if (body.testType === ECryoPreservationType.Embryo) {
      updateData.details = body.details;
      updateData.status = "Completed";
    }

    if (body.details.files && body.details.files.length > 0) {
      for (let i = 0; i < body.details.files.length; i++) {
        const s3UrlParts = parseS3Url(body.details.files[i]);
        if (s3UrlParts) {
          await S3KeepPermanently(s3UrlParts.bucketName, s3UrlParts.key);
        } else {
          throw new ErrorMessage(400, "Invalid image URL");
        }
      }
    }

    const cryopreservation = await PatientCryoPreservation.findByIdAndUpdate(id, updateData, {
      new: true,
    }).populate([
      {
        path: "cryo",
        model: MasterCryoPreservations.modelName,
      },
      {
        path: "doctor",
        model: Doctors.modelName,
        select: "firstName lastName",
      },
    ]);

    console.log(
      "Cryo Preservation Updated successfully",
      JSON.stringify(cryopreservation, null, 2)
    );

    // Generate Report if cryopreservation is completed
    if (cryopreservation && cryopreservation.status === "Completed") {
      const report = processDataForReport(cryopreservation);
      console.log("Report Data: ", JSON.stringify(report, null, 2));

      // Send to SNS
      await SNSService.publishMessage({
        Message: JSON.stringify(report),
        TopicArn: process.env.REPORT_HTML_GENERATION_TOPIC_ARN,
      });
    }

    return successResponse("cryopreservation Updated successfully", cryopreservation);
  } catch (error) {
    return errorResponse(error);
  }
};

const processDataForReport = (data: any) => {
  const reportData: IReportData = {
    bucket: EBuckets.UserReports,
    documentType: EDocumentTypes.CryoPreservation,
    templateType: EReportTemplateTypes.Reports,
    doctor: data.doctor.firstName + " " + data.doctor.lastName,
    patient: data.patient,
    clinic: data.clinicId,
    sections: [],
    reportName: "",
    fileName: _.kebabCase(data.cryo.name),
    reportId: data._id,
  };

  reportData.reportName = `${data.cryo.name} Report`;
  reportData.sections = [...generateSections(data.details.details)];

  if (data.details.notes) {
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
