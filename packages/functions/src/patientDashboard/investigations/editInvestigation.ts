import { APIGatewayProxyHandler } from "aws-lambda";
import _ from "lodash";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";

import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import {
  generateSections,
  sanitizeReportInput,
  transformBloodTestsToKeyValuePairs,
} from "@evara-backend/core/src/lib/utils/sanitizeReportData";
import PatientInvestigation from "@evara-backend/core/src/models/patientDashboard/investigation/PatientInvestigation";
import mongoose from "mongoose";
import { ETestType } from "@evara-backend/core/src/models/patientDashboard/investigation/MedicalTests";
import { S3KeepPermanently, parseS3Url } from "../../files/_KeepPermanently";
import Doctors from "@evara-backend/core/src/models/mastersDashboard/Doctors";
import MasterInvestigation from "@evara-backend/core/src/models/patientDashboard/investigation/MasterInvestigations";
import {
  EBuckets,
  EDocumentTypes,
  EReportTemplateTypes,
  IReportData,
} from "@evara-backend/core/src/lib/types/global";
import SNSService from "@evara-backend/core/src/lib/aws/sns";

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

    if (body.testType === ETestType.BloodTest) {
      if (body.result && Object.keys(body.result).length > 0) {
        updateData.result = body.result;
      }
    } else if (body.testType === ETestType.UltrasoundScan) {
      updateData.result = body.result;
      updateData.status = "Completed";
    } else if (body.testType === ETestType.SemenAnalysis) {
      updateData.result = body.result;
      updateData.status = "Completed";
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

    const investigation = await PatientInvestigation.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate([
      {
        path: "investigation",
        model: MasterInvestigation.modelName,
      },
      {
        path: "doctor",
        model: Doctors.modelName,
        select: "firstName lastName",
      },
    ]);

    console.log(
      "Investigation Updated successfully",
      JSON.stringify(investigation, null, 2)
    );

    // Generate Report if investigation is completed
    if (investigation && investigation.status === "Completed") {
      const report = processDataForReport(investigation);
      console.log("Report Data: ", JSON.stringify(report, null, 2));

      // Send to SNS
      await SNSService.publishMessage({
        Message: JSON.stringify(report),
        TopicArn: process.env.REPORT_HTML_GENERATION_TOPIC_ARN,
      });
    }

    return successResponse("Investigation Updated successfully", investigation);
  } catch (error) {
    return errorResponse(error);
  }
};

const processDataForReport = (data: any) => {
  const reportData: IReportData = {
    bucket: EBuckets.UserReports,
    documentType: EDocumentTypes.Investigation,
    templateType: EReportTemplateTypes.Reports,
    doctor: data.doctor.firstName + " " + data.doctor.lastName,
    patient: data.patient,
    clinic: data.clinicId,
    sections: [],
    reportName: "",
    fileName: _.kebabCase(data.result.testName),
    reportId: data._id,
  };

  if (data.investigation.testType === ETestType.BloodTest) {
    reportData.reportName = `${data.result.testName} Report`;
    const sections = [
      {
        showTitle: false,
        title: data.result.testName,
        content: transformBloodTestsToKeyValuePairs(data.result.details),
      },
    ];
    if (data.result.notes) {
      sections.push({
        showTitle: true,
        title: "Notes",
        content: {
          Notes: data.result.notes,
        },
      });
    }
    reportData.sections = sections;
  } else {
    reportData.reportName = `${data.result.testName} Report`;
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
  }

  return reportData;
};
