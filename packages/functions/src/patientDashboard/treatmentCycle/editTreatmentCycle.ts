import { APIGatewayProxyEvent, APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import { log } from 'console';
import PatientTreatmentCycle from '@evara-backend/core/src/models/patientDashboard/treatmentCycle/PatientTreatmentCycle';
import { ETreatmentCycleCategoryKey } from '@evara-backend/core/src/models/patientDashboard/treatmentCycle/DefaultTreatmentCycle';
import { Document } from 'mongoose';
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
import Patient from '@evara-backend/core/models/Patients';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import Branch from '@evara-backend/core/models/mastersDashboard/global/ClinicBranches';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
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

    // Extract query string parameters
    const params = event.queryStringParameters || {};
    const { ...conditions } = params;

    if (!conditions.editType || !conditions.category) {
      throw new ErrorMessage(400, 'Edit type and category are required');
    }

    if (!event.body) {
      throw new ErrorMessage(400, 'Data is required');
    }

    const body = JSON.parse(event.body);

    if (conditions.editType === 'update') {
      body.status = 'Completed';
    } else if (conditions.editType === 'reset') {
      body.status = 'Pending';
    }

    log('conditions', conditions);
    log('body', body);

    if (conditions.category in ETreatmentCycleCategoryKey) {
      await updateCategory(
        id,
        body,
        conditions.category as keyof typeof ETreatmentCycleCategoryKey,
        auth,
      );
    } else {
      throw new ErrorMessage(400, `Invalid category: ${conditions.category}`);
    }

    if (body.details.files && body.details.files.length > 0) {
      for (let i = 0; i < body.details.files.length; i++) {
        const s3UrlParts = parseS3Url(body.details.files[i]);
        if (s3UrlParts) {
          await S3KeepPermanently(s3UrlParts.bucketName, s3UrlParts.key);
        } else {
          throw new ErrorMessage(400, 'Invalid image URL');
        }
      }
    }

    await updateStatus(id);

    return successResponse('TreatmentCycle Updated successfully');
  } catch (error) {
    return errorResponse(error);
  }
};

async function updateCategory(
  id: string,
  body: any,
  category: keyof typeof ETreatmentCycleCategoryKey,
  auth: any,
): Promise<Document | null> {
  // Construct the MongoDB update paths dynamically based on the category
  const statusPath = `${category}.$.status`;
  const detailsPath = `${category}.$.details`;

  // MongoDB query to update the specific category subdocument
  const result = await PatientTreatmentCycle.findOneAndUpdate(
    {
      _id: id,
      [`${category}._id`]: body.documentId,
    },
    {
      $set: {
        [statusPath]: body.status,
        [detailsPath]: body.details,
      },
    },
    { new: true },
  );

  const processDataForReport = (
    data: any,
    result: any,
    patient: any,
    spouseName: string,
    branch: any,
  ) => {
    const reportData: IReportData = {
      bucket: EBuckets.UserReports,
      documentType: EDocumentTypes.TreatmentCycle,
      templateType: EReportTemplateTypes.Reports,
      doctor: `${result.doctor?.firstName || ''} ${result.doctor?.lastName || ''}`,
      patient: result.patient,
      clinic: result.clinicId,
      sections: [],
      reportName: '',
      fileName: _.kebabCase(`${category}`),
      reportId: data.documentId,
    };

    reportData.reportName = `${category} Report`;

    // Adding Patient Details section
    const patientDetails = {
      patientName: `${patient.firstName} ${patient.lastName}`,
      patientId: patient.patientId,
      gender: patient.gender,
      age: patient.age,
      spouseName: spouseName,
      admissionDate: patient.createdAt
        ? new Date(patient.createdAt).toLocaleDateString('en-GB')
        : 'N/A',
    };

    reportData.sections.push({
      showTitle: true,
      title: 'Patient Details',
      content: patientDetails,
    });

    // Extract all details from the result and remove the __v field
    const {
      __v,
      files,
      day0,
      day1,
      day2,
      day3,
      day4,
      day5,
      day6,
      ...generalDetails
    } = data.details;

    // Doctor-related fields to be replaced with their names
    const doctorFields = [
      'surgeon',
      'doctor',
      'embryologist',
      'embryologistA',
      'embryologistB',
      'embryologist1',
      'embryologist2',
      'anaesthetist',
      'gynaecologist',
      'gyneacologist1',
      'gyneacologist2',
      'gynecologistA',
      'gynecologistB',
      'assistantDoctor',
      // add other doctor-related fields here as needed
    ];

    // Define which fields require only the time part
    const timeSpecificFields = [
      'timeOfTrigger',
      'opuTime',
      'timeOfDenudation',
      'icsiTime',
      'checkTime',
      'timeOfThawing',
      'timeOfCollection',
      'timeOfDispatch',
      'timeOfEmbryoTransfer',
      'triggerTime',
    ];

    // Function to extract only the time part from a datetime string
    const formatTime = (dateString: string) => {
      return new Date(dateString).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true, // This ensures the time is in 12-hour format with AM/PM
      });
    };

    // Helper function to format date strings to dd/mm/yyyy
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('en-GB');
    };

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

    // Replace doctor fields with their names in general details
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

    // Define a regex for ISO 8601 date format
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

    // Handle date and time formatting for all other fields
    Object.keys(modifiedGeneralDetails).forEach(key => {
      if (
        typeof modifiedGeneralDetails[key] === 'string' &&
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
        ([key, value]) => value !== '' && value !== null,
      ),
    );

    reportData.sections.push({
      showTitle: true,
      title: 'General Information',
      content: filteredGeneralDetails,
    });

    // Add day0 to day6 details as separate sections if they have non-empty values
    const dayDetails = { day0, day1, day2, day3, day4, day5, day6 };
    Object.keys(dayDetails).forEach((dayKey, index) => {
      const dayDetail = dayDetails[dayKey];
      if (dayDetail) {
        // Format dates within day details
        Object.keys(dayDetail).forEach(key => {
          if (
            typeof dayDetail[key] === 'string' &&
            iso8601Regex.test(dayDetail[key])
          ) {
            dayDetail[key] = new Date(dayDetail[key]).toLocaleDateString(
              'en-GB',
            );
          }
        });

        const filteredDayDetail = Object.fromEntries(
          Object.entries(dayDetail).filter(
            ([key, value]) => value !== '' && value !== null,
          ),
        );
        if (Object.keys(filteredDayDetail).length > 0) {
          reportData.sections.push({
            showTitle: true,
            title: `Embryo Freezing Day ${index} Details`,
            content: filteredDayDetail,
          });
        }
      }
    });

    if (data.details.notes) {
      reportData.sections.push({
        showTitle: true,
        title: 'Notes',
        content: {
          Notes: data.details.notes,
        },
      });
    }

    return reportData;
  };

  if (!result) {
    console.error('No document found or updated for category:', category);
  } else {
    console.log(`Update successful for category: ${category}`, result);

    // Fetch patient data
    const patient = await Patient.findById(result.patient);
    if (!patient) {
      throw new ErrorMessage(404, 'Patient not found');
    }

    console.log('Patient Data', patient);

    // Fetch spouse name based on partnerId
    let spouseName = 'N/A';
    if (patient.partnerId) {
      const spouse = await Patient.findOne({ patientId: patient.partnerId }); // Fetch patient where patientId matches partnerId
      if (spouse) {
        spouseName = `${spouse.firstName} ${spouse.lastName}`; // Combine first name and last name of spouse
      }
    }

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

    const report = processDataForReport(
      body,
      result,
      patient,
      spouseName,
      branch,
    );
    console.log('Report Data: ', JSON.stringify(report, null, 2));

    // Send to SNS
    await SNSService.publishMessage({
      Message: JSON.stringify(report),
      TopicArn: process.env.REPORT_HTML_GENERATION_TOPIC_ARN,
    });
  }

  return result;
}

const updateStatus = async (id: string) => {
  const treatmentCycle = await PatientTreatmentCycle.findById(id).lean();
  if (!treatmentCycle) {
    throw new ErrorMessage(404, 'TreatmentCycle not found');
  }

  let status = 'Pending'; // Default to "Pending"

  const categories = [
    ETreatmentCycleCategoryKey.protocols,
    ETreatmentCycleCategoryKey.checklists,
    ETreatmentCycleCategoryKey.reports,
    ETreatmentCycleCategoryKey.metrics,
  ];

  const isAnyCompleted = categories.some(category =>
    treatmentCycle[category].some(item => item.status === 'Completed'),
  );

  const isAllCompleted = categories.every(category =>
    treatmentCycle[category].every(item => item.status === 'Completed'),
  );

  // Adjust status based on the checks
  if (isAllCompleted) {
    status = 'Completed';
  } else if (isAnyCompleted) {
    status = 'In-Progress';
  } // If neither is true, status remains "Pending"

  log('status', status);
  // log("Treatment Cycle", treatmentCycle);

  await PatientTreatmentCycle.findByIdAndUpdate(id, {
    $set: { status: status },
  });
};
