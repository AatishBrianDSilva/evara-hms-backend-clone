import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import mongoose from 'mongoose';
import { log } from 'console';
import { EProcedureType } from '@evara-backend/core/src/models/patientDashboard/procedure/MedicalProcedure';
import PatientProcedures from '@evara-backend/core/src/models/patientDashboard/procedure/PatientProcedure';
import { S3KeepPermanently, parseS3Url } from 'src/files/_KeepPermanently';
import SNSService from '@evara-backend/core/lib/aws/sns';
import {
  EBuckets,
  EDocumentTypes,
  EReportTemplateTypes,
  IReportData,
} from '@evara-backend/core/lib/types/global';
import { generateSections } from '@evara-backend/core/lib/utils/sanitizeReportData';
import _ from 'lodash';
import Patient from '@evara-backend/core/src/models/Patients';
import Branch from '@evara-backend/core/models/mastersDashboard/global/ClinicBranches';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';

const formatToISTDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' });
};

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    // Extract authorization details
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, 'Unauthorized');
    }

    await connectMongoDb();

    if (!event.pathParameters) {
      throw new ErrorMessage(400, 'Path parameters are null');
    }

    const id = event.pathParameters['id'];
    if (!id) {
      throw new ErrorMessage(400, 'Id is not provided');
    }

    if (!event.body) {
      throw new ErrorMessage(400, 'Data is required');
    }

    const body = JSON.parse(event.body);

    // log("body", body);
    // log("body.files", body.files); // Log body.files
    // log("body.result.files", body.result?.files); // Log body.result.files

    log('body', body);
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
      // updateData.status = 'Completed';
    } else if (body.testType === EProcedureType.Laparoscopy) {
      updateData.result = body.result;
      // updateData.status = 'Completed';
    } else if (body.testType === EProcedureType.PGT) {
      updateData.result = body.result;
      // updateData.status = 'Completed';
    } else if (body.testType === EProcedureType.TESA) {
      updateData.result = body.result;
      // updateData.status = 'Completed';
    }

    const existingProcedure = await PatientProcedures.findById(id);
    if (!existingProcedure) {
      throw new ErrorMessage(404, 'Procedure not found');
    }

    if (body.result?.files && body.result?.files.length > 0) {
      for (let i = 0; i < body.result.files.length; i++) {
        if (body.result.files[i].length > 0) {
          const s3UrlParts = parseS3Url(body.result.files[i]);
          if (s3UrlParts) {
            await S3KeepPermanently(s3UrlParts.bucketName, s3UrlParts.key);
          } else {
            throw new ErrorMessage(400, 'Invalid image URL');
          }
        }
      }
    }

    const procedure = await PatientProcedures.findByIdAndUpdate(
      id,
      updateData,
      { new: true },
    );

    console.log(
      'Procedure Updated successfully',
      JSON.stringify(procedure, null, 2),
    );

    // Fetch patient data
    const patient = await Patient.findById(procedure.patient);
    if (!patient) {
      throw new ErrorMessage(404, 'Patient not found');
    }

    console.log('patient data fetched', patient);

    // Fetch spouse name based on partnerId
    let spouseName = 'N/A';
    if (patient.partnerId) {
      const spouse = await Patient.findOne({ patientId: patient.partnerId }); // Fetch patient where patientId matches partnerId
      if (spouse) {
        spouseName = `${spouse.firstName} ${spouse.lastName}`; // Combine first name and last name of spouse
      }
    }

    console.log('spouse name fetched', spouseName);

    // Log the branchId and clinicId extracted from the auth
    const branchId = auth.branchId;
    const clinicId = auth.clinicId;
    console.log('Extracted Branch ID:', branchId);
    console.log('Extracted Clinic ID:', clinicId);

    // Fetch the branch using the branchId and clinicId from the auth details
    const branch = await Branch.findOne({
      code: new RegExp(`^${branchId.trim()}\\s*$`, 'i'),
      clinicId: clinicId,
      isActive: true,
    }).lean();

    if (!branch) {
      console.log('Branch not found');
      throw new ErrorMessage(404, 'Branch not found');
    }

    console.log('Branch found:', branch);

    // Generate Report if investigation is completed
    if (procedure && procedure.status === 'Completed') {
      const report = processDataForReport(
        procedure,
        patient,
        spouseName,
        branch,
        body.actualName,
      );
      console.log('Report Data: ', JSON.stringify(report, null, 2));

      // Send to SNS
      await SNSService.publishMessage({
        Message: JSON.stringify(report),
        TopicArn: process.env.REPORT_HTML_GENERATION_TOPIC_ARN,
      });
    }

    return successResponse('Procedure Updated successfully', procedure);
  } catch (error) {
    return errorResponse(error);
  }
};

const processDataForReport = (
  data: any,
  patient: any,
  spouseName: string,
  branch: any,
  actualName: any,
) => {
  console.log('Data ar report createion', data);
  const reportName =
    actualName || data.result?.procedureName || 'Default Procedure Name';

  const reportData: IReportData = {
    bucket: EBuckets.UserReports,
    documentType: EDocumentTypes.Procedure,
    templateType: EReportTemplateTypes.Reports,
    doctor: `${data.doctor?.firstName || ''} ${data.doctor?.lastName || ''}`,
    patient: data.patient,
    clinic: data.clinicId,
    sections: [],
    reportName,
    fileName: _.kebabCase(reportName),
    reportId: data._id,
  };

  // Extract all details from the result and remove the __v field
  const { __v, files, embryoBiopsyDetails, ...generalDetails } =
    data.result.details;

  // Adding Patient Details section
  // Adding Patient Details section using the patient data
  const patientDetails = {
    patientName: `${patient.firstName} ${patient.lastName}`,
    patientId: patient.patientId,
    gender: patient.gender,
    age: patient.age,
    spouseName: spouseName, // Now using fetched spouseName
    createdAt: data.createdAt
      ? new Date(data.createdAt).toLocaleDateString('en-GB', {
          timeZone: 'Asia/Kolkata',
        })
      : 'N/A',
  };

  reportData.sections.push({
    showTitle: true,
    title: 'Patient Details',
    content: patientDetails,
  });

  // Check if branch has a valid address and format it
  let branchAddress = 'Address not available';
  if (branch && branch.address) {
    const { street, city, state, zip } = branch.address;
    branchAddress = `${street ? street + ', ' : ''}${city ? city + ', ' : ''}${
      state ? state + ' - ' : ''
    }${zip || ''}`;
  }

  // Add Branch Address section
  const branchDetails = {
    Branch: branch.branchName || 'N/A',
    Address: branchAddress,
    Phone: branch.phone || 'N/A',
    Email: branch.email || 'N/A',
  };

  reportData.sections.push({
    showTitle: true,
    title: 'Branch Details',
    content: branchDetails,
  });
  // Doctor-related fields to be replaced with their names
  const doctorFields = [
    'surgeon',
    'embryologist',
    'anaesthetist',
    'gynaecologist',
    // add other doctor-related fields here as needed
  ];

  // Replace doctor fields with "Dr." prefix and their names in general details
  const modifiedGeneralDetails = { ...generalDetails };
  doctorFields.forEach(field => {
    if (
      modifiedGeneralDetails[field] &&
      modifiedGeneralDetails[field].firstName &&
      modifiedGeneralDetails[field].lastName
    ) {
      modifiedGeneralDetails[field] =
        `${modifiedGeneralDetails[field].firstName} ${modifiedGeneralDetails[field].lastName}`;
    } else if (modifiedGeneralDetails[field]) {
      modifiedGeneralDetails[field] =
        `${modifiedGeneralDetails[field].firstName || ''} ${
          modifiedGeneralDetails[field].lastName || ''
        }`;
    }
  });

  // Define a regex for ISO 8601 date format as dates are in string with this format
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

  // Format dates to dd/mm/yyyy if they are date strings
  Object.keys(modifiedGeneralDetails).forEach(key => {
    if (
      typeof modifiedGeneralDetails[key] === 'string' &&
      iso8601Regex.test(modifiedGeneralDetails[key])
    ) {
      modifiedGeneralDetails[key] = new Date(
        modifiedGeneralDetails[key],
      ).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' });
    }
  });

  // Remove keys with empty string or null values
  const filteredGeneralDetails = Object.fromEntries(
    Object.entries(modifiedGeneralDetails).filter(
      ([key, value]) => value !== '' && value !== null,
    ),
  );

  reportData.sections.push({
    showTitle: true,
    title: 'General Information',
    content: filteredGeneralDetails,
  });

  // Add Embryo Biopsy Details as a separate section
  if (embryoBiopsyDetails && embryoBiopsyDetails.length > 0) {
    const formattedEmbryoBiopsyDetails = embryoBiopsyDetails.map(
      (detail, index) => {
        const formattedDetail = {};
        Object.keys(detail).forEach(key => {
          const value = detail[key];
          if (typeof value === 'string' && iso8601Regex.test(value)) {
            formattedDetail[_.startCase(key)] = formatToISTDate(value);
          } else {
            formattedDetail[_.startCase(key)] = value;
          }
        });
        return {
          title: `Embryo Biopsy ${index + 1}`,
          content: formattedDetail,
        };
      },
    );

    formattedEmbryoBiopsyDetails.forEach(section => {
      reportData.sections.push({
        showTitle: true,
        title: section.title,
        content: section.content,
      });
    });
  }

  if (data.result.notes) {
    reportData.sections.push({
      showTitle: true,
      title: 'Notes',
      content: {
        Notes: data.result.notes,
      },
    });
  }

  return reportData;
};
