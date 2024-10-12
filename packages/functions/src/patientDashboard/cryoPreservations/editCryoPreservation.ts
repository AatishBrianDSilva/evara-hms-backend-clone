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

    // Fetch patient data
    const patient = await Patient.findById(cryopreservation.patient);
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

    // Generate Report if cryopreservation is completed
    if (cryopreservation && cryopreservation.status === "Completed") {
      const report = processDataForReport(
        cryopreservation,
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

    return successResponse("cryopreservation Updated successfully", cryopreservation);
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
    documentType: EDocumentTypes.CryoPreservation,
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

  // Helper function to format date strings to dd/mm/yyyy
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB");
  };

  // Define which fields require only the time part
  const timeSpecificFields = ["time"];

  // Extract all details from the result and remove the __v field
  const { __v, files, sperm_wash_items, ...generalDetails } = data.details.details;

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
      ] = `Dr. ${modifiedGeneralDetails[field].firstName} ${modifiedGeneralDetails[field].lastName}`;
    } else if (modifiedGeneralDetails[field]) {
      modifiedGeneralDetails[field] = `Dr. ${modifiedGeneralDetails[field].firstName || ""} ${
        modifiedGeneralDetails[field].lastName || ""
      }`;
    }
  });

  // Define a regex for ISO 8601 date format as dates are in string with this format
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

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
