import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { SNSHandler } from 'aws-lambda';
import * as SQS from 'aws-sdk/clients/sqs';
import { formatToIndianCurrencyFormat } from '@evara-backend/core/src/lib/utils/formatToIndianCurrencyFormat'; // Adjust the path accordingly

import {
  EDocumentTypes,
  EReportTemplateTypes,
  IPDFGeneratorMessage,
  IReportData,
} from '@evara-backend/core/src/lib/types/global';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import Patient from '@evara-backend/core/src/models/Patients';
import Clinic from '@evara-backend/core/src/models/mastersDashboard/Clinic';
import SQSService from '@evara-backend/core/src/lib/aws/sqs';
import axios from 'axios';
import Branch from '@evara-backend/core/models/mastersDashboard/global/ClinicBranches';
import { differenceInYears } from 'date-fns';
import {
  formatDateIST,
  formatTimeIST,
} from '@evara-backend/core/src/lib/utils/formatDateIST';
const TEMPLATE_PATH = path.resolve(__dirname, '../../../core/src/templates');

const logoUrl =
  'https://evara-hms-clinics-devs.s3.ap-south-1.amazonaws.com/Evara+new+logo+1.1.png';

async function getBase64ImageFromUrl(imageUrl: string): Promise<string> {
  const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(response.data, 'binary');
  const base64Image = buffer.toString('base64');
  return `data:image/png;base64,${base64Image}`;
}

const getHtmlTemplate = async (templateType: string): Promise<string> => {
  const templatePath = path.join(TEMPLATE_PATH, `${templateType}.handlebars`);
  console.log('Path', templatePath);
  return fs.promises.readFile(templatePath, 'utf8');
};

const generateHtml = (template: string, data: any): string => {
  Handlebars.registerHelper('formatCurrency', value => {
    return formatToIndianCurrencyFormat(value);
  });

  Handlebars.registerHelper('formatDateIST', formatDateIST);

  Handlebars.registerHelper('formatTimeIST', formatTimeIST);

  Handlebars.registerHelper('properCase', str => {
    if (typeof str !== 'string') return str;

    str = str.replace(/([a-z])([A-Z])/g, '$1 $2');

    return str.replace(/\b\w/g, (char: string) => char.toUpperCase());
  });

  Handlebars.registerHelper('capitalizeFirst', str => {
    if (typeof str !== 'string') return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  });

  Handlebars.registerHelper('lt', function (a, b) {
    return a < b;
  });

  Handlebars.registerHelper('gte', function (a, b) {
    return a >= b;
  });

  Handlebars.registerHelper('eq', function (a, b) {
    return a === b;
  });

  Handlebars.registerHelper(
    'getSectionByTitle',
    function (sections, title, options) {
      if (!Array.isArray(sections)) {
        return options.inverse(this);
      }

      const section = sections.find(section => section.title === title);

      if (section) {
        return options.fn(section);
      }

      return options.inverse(this);
    },
  );

  Handlebars.registerHelper('inc', function (value) {
    return parseInt(value) + 1;
  });

  Handlebars.registerHelper('getValue', function (object, key) {
    return object ? object[key] : null;
  });

  Handlebars.registerHelper('startsWith', function (str, prefix) {
    if (typeof str !== 'string') {
      str = String(str);
    }
    return str.startsWith(prefix);
  });

  Handlebars.registerHelper('capitalizeFirst', function (str) {
    if (typeof str !== 'string') return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  Handlebars.registerHelper('toUpperCase', function (str) {
    if (typeof str !== 'string') return str;
    return str.toUpperCase();
  });

  Handlebars.registerHelper('mod', function (a, b, options) {
    if (typeof a !== 'number' || typeof b !== 'number') {
      return ''; // Return empty if inputs are not numbers
    }

    const isMod = a % b === 0;

    // Support block-style helpers
    if (options && typeof options.fn === 'function') {
      return isMod ? options.fn(this) : options.inverse(this);
    }

    // Fallback for non-block usage
    return isMod;
  });

  Handlebars.registerHelper(
    'showIfContainsTitle',
    function (title, substring, options) {
      if (typeof title === 'string' && title.includes(substring)) {
        return options.fn(this); // Render the block if title contains the substring
      }
      return options.inverse(this); // Otherwise, render the inverse block
    },
  );

  const compiledTemplate = Handlebars.compile(template);
  return compiledTemplate(data);
};

const generateHeaderHtml = (
  header: any,
  styles: any,
  sections: any,
  documentType: string,
): string => {
  if (
    documentType === 'PurchaseOrder' ||
    documentType === 'PurchaseOrderProcessed'
  ) {
    // Extract PO number and date from "Purchase Order Details" section
    const poDetailsSection = sections.find(
      (section: any) => section.title === 'Purchase Order Details',
    );
    const poNumber = poDetailsSection?.content['PO Number'] || 'N/A';
    const poDate = poDetailsSection?.content['Date'] || 'N/A';

    // Extract vendor and branch addresses
    const addressSection = sections.find(
      (section: any) => section.title === 'Address Information',
    );
    const vendorAddress =
      addressSection?.content['Vendor Address'] ||
      'Vendor address not available';
    const branchAddress =
      addressSection?.content['Branch Address'] ||
      'Branch address not available';

    return `
      <!-- Header with Logo, PO Number & Date -->
      <header style="padding: 20px; box-sizing: border-box; width: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <!-- Logo on the left -->
          <div style="flex: 1; display: flex; align-items: center;">
            <img src="${header.logo}" alt="Logo" style="width: 140px; height: 67px; object-fit: contain;" />
          </div>
    
          <!-- PO Number & Date on the right -->
          <div style="text-align: right;">
            <p style="margin: 0; font-size: 16px;">Purchase Order: ${poNumber}</p>
            <p style="margin: 0; font-size: 14px;">Date: ${poDate}</p>
          </div>
        </div>
    
        <!-- Divider -->
        <hr style="border: 1px solid #000; margin: 10px 0;">
      </header>
    `;
  } else if (documentType === 'Invoice') {
    // Extract PO number and date from "Purchase Order Details" section
    const branchSection = sections.find(
      (section: any) => section.title === 'Branch Details',
    );
    const branchAddress = branchSection
      ? branchSection.content.Address
      : 'Address not available';

    return `
<header style="display: flex; justify-content: space-between; align-items: flex-start; width: 94%; padding: 1px 0; box-sizing: border-box; margin-left: auto; margin-right: auto;">
  <div style="width: 140px; height: 67px; padding-top: 10px;">
    <img src="${header.logo}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;" />
  </div>
  <div style="flex-grow: 1; text-align: center;">
    <p style="margin: 0 0 2px 0; font-size: 16px; font-weight: bold; color: #808080 !important; text-decoration: underline;">TAX INVOICE</p>
    <p style="margin: 0; font-size: 18px; font-weight: bold;">Evara Fertility & IVF Centre</p>
    <p style="margin: 0; font-size: 14px">(A Unit of Evara Health Private Limited)</p>
    <p style="margin: 0; font-size: 14px">${branchAddress}</p>
  </div>
  <div style="width: 140px;"></div>
</header>
    `;
  }

  // Default header for other document types
  const branchSection = sections.find(
    (section: any) => section.title === 'Branch Details',
  );
  const branchAddress = branchSection
    ? branchSection.content.Address
    : 'Address not available';

  return `
    <header style="display: flex; justify-content: space-between; align-items: flex-start; width: 94%; padding: 15px 0; box-sizing: border-box; margin-left: auto; margin-right: auto;">
      <div style="width: 140px; height: 67px; padding-top: 10px;">
        <img src="${header.logo}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;" />
      </div>
      <div style="flex-grow: 1; text-align: center;">
        <p style="margin: 10px 0 0 0; font-size: 18px; font-weight: bold;">Evara Fertility & IVF Centre</p>
        <p style="margin: 0; font-size: 14px">(A Unit of Evara Health Private Limited)</p>
          <p style="margin: 0; font-size: 14px">${branchAddress}</p>
        </div>
      </div>
      <div style="width: 140px;"></div>
    </header>
  `;
};

const generateFooterHtml = (): string => {
  const currentDate = new Date()
    .toLocaleDateString('en-In', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    .replace(/ /g, '-');

  return `
    <footer style="width: 94%; padding: 10px 0; font-size: 16px; color: grey; text-align: center; border-top: 2px solid #288BDB; margin-left: auto; margin-right: auto;">
      Bill generated on ${currentDate} - evarahealth.in
    </footer>
  `;
};

const generateHtmlWithContentBorders = (bodyHtml: string): string => {
  return `
    <div style="width: 100%; box-sizing: border-box; padding: 0;">
      ${bodyHtml}
    </div>
  `;
};

const generateHeaderHtmlV2 = (
  header: any,
  documentType: EDocumentTypes,
): string => {
  switch (documentType) {
    case EDocumentTypes.Investigation:
    case EDocumentTypes.Procedure:
    case EDocumentTypes.CryoPreservation:
    case EDocumentTypes.TreatmentCycle:
    case EDocumentTypes.MedicalHistory:
      return `
      <header style="display: flex; justify-content: space-between; align-items: flex-start; width: 94%; padding: 15px 0; box-sizing: border-box; margin-left: auto; margin-right: auto;">
        <div style="width: 140px; height: 67px; padding-top: 10px;">
          <img src="${header.logo}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;" />
        </div>
        <div style="flex-grow: 1; text-align: center;">
          <p style="margin: 10px 0 0 0; font-size: 18px; font-weight: bold;">Evara Fertility & IVF Centre</p>
          <p style="margin: 0; font-size: 14px">(A Unit of Evara Health Private Limited)</p>
          <p style="margin: 0; font-size: 14px">${header.branchAddress}</p>
        </div>
        <div style="width: 140px;"></div>
      </header>
    `;
    case EDocumentTypes.PurchaseOrder:
    case EDocumentTypes.PurchaseOrderProcessed:
    case EDocumentTypes.Invoice:
      return `
      <header style="display: flex; justify-content: space-between; align-items: flex-start; width: 94%; padding: 15px 0; box-sizing: border-box; margin-left: auto; margin-right: auto;">
        <div style="width: 140px; height: 67px; padding-top: 10px;">
          <img src="${header.logo}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;" />
        </div>
        <div style="flex-grow: 1; text-align: center;">
          <h1 style="margin: 0; font-size: 14px; text-decoration: underline; background: #5C5C5C; color: white; padding: 5px;">Bill of Supply & Tax Invoice</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px; font-weight: bold;">Evara Fertility & IVF Centre</p>
          <p style="margin: 0; font-size: 14px">(A Unit of Evara Health Private Limited)</p>
          <p style="margin: 0; font-size: 14px">${header.branchAddress}</p>
        </div>
        <div style="width: 140px;"></div>
      </header>
    `;
    default:
      return `
      <header style="display: flex; justify-content: space-between; align-items: flex-start; width: 94%; padding: 15px 0; box-sizing: border-box; margin-left: auto; margin-right: auto;">
        <div style="width: 140px; height: 67px; padding-top: 10px;">
          <img src="${header.logo}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;" />
        </div>
        <div style="flex-grow: 1; text-align: center;">
          <h1 style="margin: 0; font-size: 14px; text-decoration: underline; background: #5C5C5C; color: white; padding: 5px;">Bill of Supply & Tax Invoice</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px; font-weight: bold;">Evara Fertility & IVF Centre</p>
          <p style="margin: 0; font-size: 14px">(A Unit of Evara Health Private Limited)</p>
          <p style="margin: 0; font-size: 14px">${header.branchAddress}</p>
        </div>
        <div style="width: 140px;"></div>
      </header>
    `;
  }
};

const generateHtmlForInternalConsumption = async (data: IReportData) => {
  try {
    const logo = await getBase64ImageFromUrl(logoUrl);

    console.log(
      'Processing Internal Consumption Report:',
      JSON.stringify(data, null, 2),
    );

    // ✅ Extract the Internal Consumption ID
    const internalConsumptionDetails = data.sections.find(
      section => section.title === 'Internal Consumption Details',
    );
    const debitNoteNumber =
      internalConsumptionDetails?.content['Report Id'] || 'N/A';
    const reportDate = internalConsumptionDetails?.content['Date'] || 'N/A';

    console.log(`✅ Extracted Debit Note Number: ${debitNoteNumber}`);
    console.log(`✅ Extracted Date: ${reportDate}`);

    // ✅ Fetch clinic and branch details
    const clinic = await Clinic.findOne({ code: data.clinic }).lean();
    if (!clinic) {
      console.error('❌ Clinic not found');
      return null;
    }

    const branch = await Branch.findOne({
      code: new RegExp(`^${data.branch.trim()}\\s*$`, 'i'),
      clinicId: data.clinic,
      isActive: true,
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
    }).lean();

    if (!branch) {
      console.error('❌ Branch not found:', {
        branchCode: data.branch,
        clinicId: data.clinic,
      });
      return null;
    }

    // ✅ Extract branch address
    const addressSection = data.sections.find(
      section => section.title === 'Address Information',
    );
    const branchAddress =
      addressSection?.content['Branch Address'] ||
      'Branch address not available';

    console.log(`✅ Extracted Branch Address: ${branchAddress}`);

    // ✅ Extract items
    const itemsSection = data.sections.find(
      section => section.title === 'Items',
    );
    const items = itemsSection?.content || [];

    console.log(`✅ Extracted Items: ${JSON.stringify(items, null, 2)}`);

    // ✅ Prepare template data
    const templateData = {
      branchAddress: branchAddress, // Pass Branch Address
      items: items, // Pass Items
      reportName: data.reportName || 'Internal Consumption Report',
      styles: {
        primaryColor: '#FF5C00',
        secondaryColor: '#10535E',
      },
    };

    console.log(
      '🚀 Sending Data to Handlebars Template:',
      JSON.stringify(templateData, null, 2),
    );

    // ✅ Generate header and footer HTML
    const headerHtml = `
      <header style="display: flex; justify-content: space-between; align-items: center; height: 120px; padding: 0 40px; border-bottom: 1px solid #333;">
        <!-- Left: Logo -->
        <div style="height: 100px;">
          <img src="${logo}" alt="Logo" style="height: 100px; width: 100px; object-fit: contain;" />
        </div>

        <!-- Right: Debit Note & Date -->
        <div style="text-align: right;">
          <div style="font-size: 32px; color: #10535E; font-weight: bold;">Debit Note #${debitNoteNumber}</div>
          <div style="font-size: 18px; color: black; font-style: italic;">Date: ${reportDate}</div>
        </div>
      </header>
    `;

    const footerHtml = generateFooterHtml();

    // ✅ Fetch and compile the template with extracted data
    const template = await getHtmlTemplate(data.templateType);
    const htmlContent = generateHtml(template, templateData);

    console.log(
      '📌 Sections sent to template:',
      JSON.stringify(data.sections, null, 2),
    );

    if (!htmlContent) {
      console.error('❌ Failed to generate HTML content');
      return null;
    }

    const fullHtml = `
    ${headerHtml}
    <main style="padding: 0 40px;">
      ${htmlContent}
    </main>
    ${footerHtml}
    `;

    console.log('🔍 Final HTML Data:', {
      headerHtml,
      footerHtml,
      htmlContent,
    });

    return {
      headerHtml,
      footerHtml,
      htmlContent,
    };
  } catch (error) {
    console.error('❌ Error generating HTML for Internal Consumption:', error);
    return null;
  }
};

export const main: SNSHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb();
    for (const record of event.Records) {
      const rawData = record.Sns.Message;

      const data: IReportData = JSON.parse(rawData);

      console.log('SNS Message', JSON.stringify(data, null, 2));

      if (
        data.documentType === EDocumentTypes.Investigation &&
        data.templateType === EReportTemplateTypes.SemenAnalysis
      ) {
        await generateSemenAnalysisReport(data);
        continue;
      }

      if (
        data.documentType === EDocumentTypes.Investigation &&
        data.templateType === EReportTemplateTypes.SpermDFI
      ) {
        await generateSpermDFIReport(data);
        continue;
      }

      if (data.documentType === EDocumentTypes.InternalConsumption) {
        console.log('Generating Internal Consumption report...');
        const internalConsumptionHtml =
          await generateHtmlForInternalConsumption(data);

        if (!internalConsumptionHtml) {
          console.error('Failed to generate HTML for Internal Consumption');
          continue; // Skip processing if HTML generation failed
        }

        const internalConsumptionKey = `${data.clinic}/internal-consumption/${data.reportId}-${data.fileName}.pdf`;

        console.log('Sending Internal Consumption Report to SQS:', {
          headerHtml: internalConsumptionHtml.headerHtml,
          footerHtml: internalConsumptionHtml.footerHtml,
          htmlContent: internalConsumptionHtml.htmlContent,
        });

        await sendMessageToQueue({
          headerHtml: internalConsumptionHtml.headerHtml,
          footerHtml: internalConsumptionHtml.footerHtml,
          htmlContent: internalConsumptionHtml.htmlContent,
          bucket: data.bucket,
          key: internalConsumptionKey,
          patient: null,
          doctor: null,
          category: data.documentType,
          reportName: data.reportName,
          source_report_id: data.reportId,
        });

        // console.log(
        //   'Sending Internal Consumption Report to SQS:',
        //   JSON.stringify(sendMessageToQueue, null, 2),
        // );

        continue;
      }

      let clinic = null;
      let patient = null;

      let addressData = null; // Initialize address data

      if (
        data.documentType === EDocumentTypes.PurchaseOrder ||
        data.documentType === EDocumentTypes.PurchaseOrderProcessed
      ) {
        clinic = await Clinic.findOne({ code: data.clinic }).lean();
        if (!clinic) {
          console.error('Clinic not found');
          return;
        }

        addressData = {
          vendorAddress:
            data.sections
              .find(section => section.title === 'Address Information')
              ?.content['Vendor Address']?.replace(/,\s*TIN:\s*N\/A$/, '') ||
            'Vendor address not available',
          branchAddress:
            data.sections.find(
              section => section.title === 'Address Information',
            )?.content['Branch Address'] || 'Branch address not available',
        };
      } else {
        patient = await Patient.findById(data.patient).lean();
        if (!patient) {
          console.error('Patient not found');
          return;
        }

        clinic = await Clinic.findOne({ code: data.clinic }).lean();
        if (!clinic) {
          console.error('Clinic not found');
          return;
        }

        console.log('Sections Array:', JSON.stringify(data.sections, null, 2));

        const branchSection = data.sections.find(
          section => section.title === 'Branch Details',
        );
        const branchAddress = branchSection
          ? branchSection.content.Address
          : 'Address not available';

        addressData = {
          branchAddress: branchAddress, // Use branch details from sections
        };
      }

      const logo = await getBase64ImageFromUrl(logoUrl);

      const header = {
        logo: logo,
        clinicName: clinic?.name,
        clinicAddress: `${clinic?.headOfficeAddress?.street}, ${clinic?.headOfficeAddress?.city}, ${clinic?.headOfficeAddress?.state}, ${clinic?.headOfficeAddress?.pincode}`,
        patientName: patient?.firstName + ' ' + patient?.lastName,
        patientId: patient?.patientId || patient?._id,
        doctorName: data.doctor,
        reportName: data.reportName,
      };

      console.log('Data details', data.details);

      // Extract and convert uploaded images to base64
      const uploadedImages = [];
      if (data.details?.files) {
        for (const [index, fileUrl] of data.details?.files.entries()) {
          const base64Image = await getBase64ImageFromUrl(fileUrl);
          uploadedImages.push({
            label: `Image ${index + 1}`,
            src: base64Image,
          });
        }
      }

      const templateData = {
        header,
        sections: data.sections,
        fileName: data.documentType,
        addressData, // Pass the address data to the template
        uploadedImages, // Add the images to the template data

        styles: {
          primaryColor: '#FF5C00',
          secondaryColor: '#10535E',
        },
      };

      const template = await getHtmlTemplate(data.templateType);
      const htmlContent = generateHtml(template, templateData);

      const headerHtml = generateHeaderHtml(
        templateData.header,
        templateData.styles,
        templateData.sections,
        data.documentType,
      );

      const footerHtml = generateFooterHtml(templateData.styles);
      const htmlContentWithBorders =
        generateHtmlWithContentBorders(htmlContent);

      const key = patient
        ? `${patient._id}/${data.documentType}/generated/${data.reportId}-${data.fileName}.pdf`
        : `${clinic._id}/${data.documentType}/generated/${data.reportId}-${data.fileName}.pdf`;

      const pdfGeneratorMessage: IPDFGeneratorMessage = {
        headerHtml,
        footerHtml,
        htmlContent: htmlContentWithBorders,
        bucket: data.bucket,
        key: key,
        patient: data.patient,
        doctor: data.doctor,
        category: data.documentType,
        reportName: data.reportName,
        source_report_id: data.reportId,
      };

      await sendMessageToQueue(pdfGeneratorMessage);
      console.log(
        'Message sent to SQS:',
        JSON.stringify(pdfGeneratorMessage, null, 2),
      );
    }
  } catch (error) {
    console.error(error);
  }
};

const sendMessageToQueue = async (message: IPDFGeneratorMessage) => {
  const queueUrl = process.env.REPORT_PDF_GENERATION_QUEUE_URL;
  if (!queueUrl) {
    throw new Error(
      "Environment variable 'REPORT_PDF_GENERATION_QUEUE_URL' is not set.",
    );
  }
  const sqsParams: SQS.SendMessageRequest = {
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(message),
  };

  await SQSService.sendMessage(sqsParams);
};

const generateSemenAnalysisReport = async (data: IReportData) => {
  console.log('Semen Analysis Report Generation');

  const logo = await getBase64ImageFromUrl(logoUrl);

  const patient = await Patient.findById(data.patient).lean();
  if (!patient) {
    console.error('Patient not found');
    return;
  }

  // Fetch spouse name based on partnerId
  let spouseName = 'N/A';
  if (patient.partnerId) {
    const spouse = await Patient.findOne({ patientId: patient.partnerId }); // Fetch patient where patientId matches partnerId
    if (spouse) {
      spouseName = `${spouse.firstName} ${spouse.lastName}`; // Combine first name and last name of spouse
    }
  }

  const clinic = await Clinic.findOne({ code: data.clinic }).lean();
  if (!clinic) {
    console.error('Clinic not found');
    return;
  }

  const branch = await Branch.findOne({ code: data.branch }).lean();
  if (!branch) {
    console.error('Branch not found');
    return;
  }

  const branchAddress = branch?.address
    ? `${branch?.address?.street}, ${branch?.address?.city}, ${branch?.address?.state}, ${branch?.address?.zip}`
    : 'Address not available';

  const header = {
    logo: logo,
    clinicName: clinic?.name,
    branchName: branch?.branchName,
    branchAddress: branchAddress,
    doctorName: data.doctor,
    reportName: data.reportName,
  };

  const template = await getHtmlTemplate(data.templateType);

  const headerHtml = generateHeaderHtmlV2(header, data.documentType);

  const footerHtml = generateFooterHtml();

  const templateData = {
    patientData: {
      name: patient?.firstName + ' ' + patient?.lastName,
      id: patient?.patientId || patient?._id,
      age: patient?.dob ? differenceInYears(new Date(), patient?.dob) : 'N/A',
      gender: patient?.gender,
      admissionDate: formatDateIST(data?.result?.createdAt, 'dd-MM-yyyy'),
      spouseName: spouseName,
    },
    semenAnalysisData: data.result?.details,
    styles: {
      primaryColor: '#FF5C00',
      secondaryColor: '#10535E',
    },
  };

  const htmlContent = generateHtml(template, templateData);

  const key = `${patient._id}/${data.documentType}/generated/${data.reportId}-${data.fileName}.pdf`;

  const pdfGeneratorMessage: IPDFGeneratorMessage = {
    headerHtml,
    footerHtml,
    htmlContent: htmlContent,
    bucket: data.bucket,
    key: key,
    patient: data.patient,
    doctor: data.doctor,
    category: data.documentType,
    reportName: data.reportName,
    source_report_id: data.reportId,
  };

  await sendMessageToQueue(pdfGeneratorMessage);
  console.log(
    'Message sent to SQS:',
    JSON.stringify(pdfGeneratorMessage, null, 2),
  );
};

const generateSpermDFIReport = async (data: IReportData) => {
  console.log('Sperm DFI Report Generation');

  const logo = await getBase64ImageFromUrl(logoUrl);

  const patient = await Patient.findById(data.patient).lean();
  if (!patient) {
    console.error('Patient not found');
    return;
  }

  const clinic = await Clinic.findOne({ code: data.clinic }).lean();
  if (!clinic) {
    console.error('Clinic not found');
    return;
  }

  const branch = await Branch.findOne({ code: data.branch }).lean();
  if (!branch) {
    console.error('Branch not found');
    return;
  }

  const branchAddress = branch?.address
    ? `${branch?.address?.street}, ${branch?.address?.city}, ${branch?.address?.state}, ${branch?.address?.zip}`
    : 'Address not available';

  const header = {
    logo: logo,
    clinicName: clinic?.name,
    branchName: branch?.branchName,
    branchAddress: branchAddress,
    doctorName: data.doctor,
    reportName: data.reportName,
  };

  // Process uploaded images

  const uploadedImages = [];
  if (data.result?.files) {
    for (const [index, fileUrl] of data.result?.files.entries()) {
      uploadedImages.push({
        label: `Image ${index + 1}`,
        url: fileUrl, // Keep only the URL
      });
    }
  }

  const template = await getHtmlTemplate(data.templateType);

  const headerHtml = generateHeaderHtmlV2(header, data.documentType);

  const footerHtml = generateFooterHtml();

  const templateData = {
    patientData: {
      name: patient?.firstName + ' ' + patient?.lastName,
      id: patient?.patientId || patient?._id,
      age: patient?.dob ? differenceInYears(new Date(), patient?.dob) : 'N/A',
      gender: patient?.gender,
      admissionDate: formatDateIST(data?.result?.createdAt, 'dd-MM-yyyy'),
    },
    spermDFIData: data.result?.details, // Use specific details for Sperm DFI
    uploadedImages, // Add uploaded images to the template data
    styles: {
      primaryColor: '#FF5C00',
      secondaryColor: '#10535E',
    },
  };

  const htmlContent = generateHtml(template, templateData);

  const key = `${patient._id}/${data.documentType}/generated/${data.reportId}-${data.fileName}.pdf`;

  const pdfGeneratorMessage: IPDFGeneratorMessage = {
    headerHtml,
    footerHtml,
    htmlContent: htmlContent,
    bucket: data.bucket,
    key: key,
    patient: data.patient,
    doctor: data.doctor,
    category: data.documentType,
    reportName: data.reportName,
    source_report_id: data.reportId,
  };

  await sendMessageToQueue(pdfGeneratorMessage);
  console.log(
    'Message sent to SQS:',
    JSON.stringify(pdfGeneratorMessage, null, 2),
  );
};
