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
import { extractAuthorizerDetails } from "@evara-backend/core/lib/utils/extractAuthorizerDetails";
import Branch from "@evara-backend/core/models/mastersDashboard/global/ClinicBranches";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    // Extract authorization details
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, "Unauthorized");
    }

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

    investigation.status = "Completed";
    await investigation.save();

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

    // Log the branchId and clinicId extracted from the auth
    const branchId = auth.branchId;
    const clinicId = auth.clinicId;
    console.log("Extracted Branch ID:", branchId);
    console.log("Extracted Clinic ID:", clinicId);

    // Fetch the branch using the branchId and clinicId from the auth details
    const branch = await Branch.findOne({
      code: new RegExp(`^${branchId.trim()}\\s*$`, "i"),
      clinicId: clinicId,
      isActive: true,
    }).lean();

    if (!branch) {
      console.log("Branch not found");
      throw new ErrorMessage(404, "Branch not found");
    }

    console.log("Branch found:", branch);

    // Generate Report if investigation is completed
    if (investigation) {
      const report = processDataForReport(
        investigation,
        patient,
        spouseName,
        branch,
        body.actualName
      );
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

const processDataForReport = (
  data: any,
  patient: any,
  spouseName: string,
  branch: any,
  actualName: any
) => {
  const reportName = actualName || data.result?.procedureName || "Default Procedure Name";

  const reportData: IReportData = {
    bucket: EBuckets.UserReports,
    documentType: EDocumentTypes.Investigation,
    templateType: EReportTemplateTypes.Reports,
    doctor: `${data.doctor?.firstName || ""} ${data.doctor?.lastName || ""}`,
    patient: data.patient,
    clinic: data.clinicId,
    sections: [],
    reportName,
    fileName: _.kebabCase(reportName),
    reportId: data._id,
  };

  // Adding Patient Details section
  const patientDetails = {
    patientName: `${patient.firstName} ${patient.lastName}`,
    patientId: patient.patientId,
    gender: patient.gender,
    age: patient.age,
    spouseName: spouseName, // Now using fetched spouseName
    admissionDate: data.updatedAt ? new Date(data.updatedAt).toLocaleDateString("en-GB") : "N/A",
  };

  reportData.sections.push({
    showTitle: true,
    title: "Patient Details",
    content: patientDetails,
  });

  // Check if branch has a valid address and format it
  let branchAddress = "Address not available";
  if (branch && branch.address) {
    const { street, city, state, zip } = branch.address;
    branchAddress = `${street ? street + ", " : ""}${city ? city + ", " : ""}${
      state ? state + " - " : ""
    }${zip || ""}`;
  }

  // Add Branch Address section
  const branchDetails = {
    Branch: branch.branchName || "N/A",
    Address: branchAddress,
    Phone: branch.phone || "N/A",
    Email: branch.email || "N/A",
  };

  reportData.sections.push({
    showTitle: true,
    title: "Branch Details",
    content: branchDetails,
  });

  // Handle General Information section
  let generalInformation = data.result.details;

  // If "0" key is present, replace general information with the values inside "0"
  if (generalInformation && generalInformation["0"]) {
    generalInformation = generalInformation["0"];
  }

  // Process general information and remove empty or null values
  if (generalInformation) {
    const details: any = {};

    // Add Doctor-related fields to be replaced with their names in general details
    const doctorFields = [
      "doctor",
      "surgeon",
      "embryologist",
      "anaesthetist",
      // Add other doctor-related fields here as needed
    ];

    for (const key in generalInformation) {
      const value = generalInformation[key];

      // Only include non-empty and non-null values
      if (value !== "" && value !== null) {
        // Format time fields to 12-hour format (AM/PM)
        if (
          key === "timeOfSampleReceivedAtHospital" ||
          key === "timeOfCollection" ||
          key === "timeOfEvaluation"
        ) {
          const timeValue = new Date(value).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          });
          details[key] = timeValue;
        }
        // Format date to dd/mm/yyyy for any date fields
        else if (key === "date") {
          const dateValue = new Date(value).toLocaleDateString("en-GB");
          details[key] = dateValue;
        }
        // Process doctor fields
        else if (doctorFields.includes(key) && value.firstName && value.lastName) {
          details[key] = `${value.firstName} ${value.lastName}`;
        } else {
          // Include the field as-is if it is valid
          details[key] = value;
        }
      }
    }

    // Add formatted general information as a section
    reportData.sections.push({
      showTitle: true,
      title: "General Information",
      content: details,
    });
  }

  // Add any notes if present
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
