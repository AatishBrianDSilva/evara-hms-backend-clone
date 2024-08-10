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
    doctor: `${data.doctor?.firstName || ""} ${data.doctor?.lastName || ""}`,
    patient: data.patient,
    clinic: data.clinicId,
    sections: [],
    reportName: "",
    fileName: _.kebabCase(data.cryo.name),
    reportId: data._id,
  };

  reportData.reportName = `${data.cryo.name} Report`;

  // Extract all details from the result and remove the __v field
  const { __v, files, sperm_wash_items, ...generalDetails } = data.details.details;

  // Doctor-related fields to be replaced with their names
  const doctorFields = [
    "surgeon",
    "embryologistA",
    "embryologistB",
    "doctor",
    "anaesthetist",
    "gynaecologist",
    // add other doctor-related fields here as needed
  ];

  // Replace doctor fields with their names in general details
  const modifiedGeneralDetails = { ...generalDetails };
  doctorFields.forEach((field) => {
    if (
      modifiedGeneralDetails[field] &&
      modifiedGeneralDetails[field].firstName &&
      modifiedGeneralDetails[field].lastName
    ) {
      modifiedGeneralDetails[
        field
      ] = `${modifiedGeneralDetails[field].firstName} ${modifiedGeneralDetails[field].lastName}`;
    } else if (modifiedGeneralDetails[field]) {
      modifiedGeneralDetails[field] = `${modifiedGeneralDetails[field].firstName || ""} ${
        modifiedGeneralDetails[field].lastName || ""
      }`;
    }
  });

  // Define a regex for ISO 8601 date format as dates are in string with this format
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

  // Format dates to dd/mm/yyyy if they match the ISO 8601 format
  Object.keys(modifiedGeneralDetails).forEach((key) => {
    if (
      typeof modifiedGeneralDetails[key] === "string" &&
      iso8601Regex.test(modifiedGeneralDetails[key])
    ) {
      modifiedGeneralDetails[key] = new Date(modifiedGeneralDetails[key]).toLocaleDateString(
        "en-GB"
      );
    }
  });

  // Remove keys with empty string or null values
  const filteredGeneralDetails = Object.fromEntries(
    Object.entries(modifiedGeneralDetails).filter(([key, value]) => value !== "" && value !== null)
  );

  reportData.sections.push({
    showTitle: true,
    title: "General Information",
    content: filteredGeneralDetails,
  });

  // Add Sperm Wash Items as separate sections
  if (sperm_wash_items && sperm_wash_items.length > 0) {
    const formattedSpermWashItems = sperm_wash_items.map((item, index) => {
      const formattedItem = {};
      Object.keys(item).forEach((key) => {
        formattedItem[_.startCase(key)] = item[key];
      });
      return {
        title: `Sperm Wash Item ${index + 1}`,
        content: formattedItem,
      };
    });

    formattedSpermWashItems.forEach((section) => {
      reportData.sections.push({
        showTitle: true,
        title: section.title,
        content: section.content,
      });
    });
  }

  if (data.details.notes) {
    reportData.sections.push({
      showTitle: true,
      title: "Notes",
      content: {
        Notes: data.details.notes,
      },
    });
  }

  return reportData;
};
