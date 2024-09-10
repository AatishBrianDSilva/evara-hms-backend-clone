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
import Patient from "@evara-backend/core/models/Patients";

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

    const investigation = await PatientInvestigation.findByIdAndUpdate(id, updateData, {
      new: true,
    }).populate([
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

    console.log("Investigation Updated successfully", JSON.stringify(investigation, null, 2));

    // Fetch patient data
    const patient = await Patient.findById(investigation.patient);
    if (!patient) {
      throw new ErrorMessage(404, "Patient not found");
    }

    console.log("patient data fetched", patient);

    // Fetch spouse name based on partnerId
    let spouseName = "N/A";
    if (patient.partnerId) {
      const spouse = await Patient.findOne({ patientId: patient.partnerId }); // Fetch patient where patientId matches partnerId
      if (spouse) {
        spouseName = `${spouse.firstName} ${spouse.lastName}`; // Combine first name and last name of spouse
      }
    }

    console.log("spouse name fetched", spouseName);

    // Generate Report if investigation is completed
    if (investigation && investigation.status === "Completed") {
      const report = processDataForReport(investigation, patient, spouseName);
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

const processDataForReport = (data: any, patient: any, spouseName: string) => {
  const reportData: IReportData = {
    bucket: EBuckets.UserReports,
    documentType: EDocumentTypes.Investigation,
    templateType: EReportTemplateTypes.Reports,
    doctor: `Dr. ${data.doctor?.firstName || ""} ${data.doctor?.lastName || ""}`,
    patient: data.patient,
    clinic: data.clinicId,
    sections: [],
    reportName: "",
    fileName: _.kebabCase(data.result.testName),
    reportId: data._id,
  };

  // Adding Patient Details section
  const patientDetails = {
    patientName: `${patient.firstName} ${patient.lastName}`,
    patientId: patient.patientId,
    gender: patient.gender,
    age: patient.age,
    spouseName: spouseName,
    admissionDate: data.updatedAt ? new Date(data.updatedAt).toLocaleDateString("en-GB") : "N/A",
  };

  reportData.sections.push({
    showTitle: true,
    title: "Patient Details",
    content: patientDetails,
  });

  // Function to extract only the time part from a datetime string
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true, // This ensures the time is in 12-hour format with AM/PM
    });
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

    // Define which fields require only the time part
    const timeSpecificFields = [
      "timeOfSampleReceivedAtHospital",
      "timeOfCollection",
      "timeOfEvaluation",
    ];

    // Extract all details from the result and remove the __v field
    const { __v, files, ...generalDetails } = data.result.details;

    // Doctor-related fields to be replaced with their names
    const doctorFields = [
      "surgeon",
      "embryologist",
      "anaesthetist",
      "gynaecologist",
      "referredBy",
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
        ] = `Dr. ${modifiedGeneralDetails[field].firstName} ${modifiedGeneralDetails[field].lastName}`;
      } else if (modifiedGeneralDetails[field]) {
        modifiedGeneralDetails[field] = `Dr. ${modifiedGeneralDetails[field].firstName || ""} ${
          modifiedGeneralDetails[field].lastName || ""
        }`;
      }
    });

    // Define a regex for ISO 8601 date format as dates are in string with this format
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

    // Helper function to format date strings to dd/mm/yyyy
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString("en-GB");
    };

    // Handle date and time formatting for all other fields
    Object.keys(modifiedGeneralDetails).forEach((key) => {
      if (
        typeof modifiedGeneralDetails[key] === "string" &&
        iso8601Regex.test(modifiedGeneralDetails[key])
      ) {
        if (timeSpecificFields.includes(key)) {
          // For specific fields, return only the time
          modifiedGeneralDetails[key] = formatTime(modifiedGeneralDetails[key]);
        } else {
          // For all other fields, return only the date
          modifiedGeneralDetails[key] = formatDate(modifiedGeneralDetails[key]);
        }
      }
    });

    // Remove keys with empty string or null values
    const filteredGeneralDetails = Object.fromEntries(
      Object.entries(modifiedGeneralDetails).filter(
        ([key, value]) => value !== "" && value !== null
      )
    );

    reportData.sections.push({
      showTitle: true,
      title: "General Information",
      content: filteredGeneralDetails,
    });

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
