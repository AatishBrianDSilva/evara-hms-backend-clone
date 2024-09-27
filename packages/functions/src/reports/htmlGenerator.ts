import * as fs from "fs";
import * as path from "path";
import * as Handlebars from "handlebars";
import { SNSHandler } from "aws-lambda";
import * as SQS from "aws-sdk/clients/sqs";
import { formatToIndianCurrencyFormat } from "@evara-backend/core/src/lib/utils/formatToIndianCurrencyFormat"; // Adjust the path accordingly

import {
  EDocumentTypes,
  IPDFGeneratorMessage,
  IReportData,
} from "@evara-backend/core/src/lib/types/global";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import Patient from "@evara-backend/core/src/models/Patients";
import Clinic from "@evara-backend/core/src/models/mastersDashboard/Clinic";
import SQSService from "@evara-backend/core/src/lib/aws/sqs";
import axios from "axios";

const TEMPLATE_PATH = path.resolve(__dirname, "../../../core/src/templates");

async function getBase64ImageFromUrl(imageUrl: string): Promise<string> {
  const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
  const buffer = Buffer.from(response.data, "binary");
  const base64Image = buffer.toString("base64");
  return `data:image/png;base64,${base64Image}`;
}

const getHtmlTemplate = async (templateType: string): Promise<string> => {
  const templatePath = path.join(TEMPLATE_PATH, `${templateType}.handlebars`);
  console.log("Path", templatePath);
  return fs.promises.readFile(templatePath, "utf8");
};

const generateHtml = (template: string, data: any): string => {
  Handlebars.registerHelper("formatCurrency", (value) => {
    return formatToIndianCurrencyFormat(value);
  });

  Handlebars.registerHelper("properCase", (str) => {
    if (typeof str !== "string") return str;

    str = str.replace(/([a-z])([A-Z])/g, "$1 $2");

    return str.replace(/\b\w/g, (char) => char.toUpperCase());
  });

  Handlebars.registerHelper("lt", function (a, b) {
    return a < b;
  });

  Handlebars.registerHelper("gte", function (a, b) {
    return a >= b;
  });

  Handlebars.registerHelper("getSectionByTitle", function (sections, title, options) {
    if (!Array.isArray(sections)) {
      return options.inverse(this);
    }

    const section = sections.find((section) => section.title === title);

    if (section) {
      return options.fn(section);
    }

    return options.inverse(this);
  });

  Handlebars.registerHelper("inc", function (value) {
    return parseInt(value) + 1;
  });

  Handlebars.registerHelper("getValue", function (object, key) {
    return object ? object[key] : null;
  });

  Handlebars.registerHelper("startsWith", function (str, prefix) {
    if (typeof str !== "string") {
      str = String(str);
    }
    return str.startsWith(prefix);
  });

  const compiledTemplate = Handlebars.compile(template);
  return compiledTemplate(data);
};
const generateHeaderHtml = (
  header: any,
  styles: any,
  sections: any,
  documentType: string
): string => {
  if (documentType === "PurchaseOrder" || documentType === "PurchaseOrderProcessed") {
    // Extract PO number and date from "Purchase Order Details" section
    const poDetailsSection = sections.find(
      (section: any) => section.title === "Purchase Order Details"
    );
    const poNumber = poDetailsSection?.content["PO Number"] || "N/A";
    const poDate = poDetailsSection?.content["Date"] || "N/A";

    // Extract vendor and branch addresses
    const addressSection = sections.find((section: any) => section.title === "Address Information");
    const vendorAddress =
      addressSection?.content["Vendor Address"] || "Vendor address not available";
    const branchAddress =
      addressSection?.content["Branch Address"] || "Branch address not available";

    return `
      <!-- Header with Logo, PO Number & Date -->
      <header style="padding: 20px; box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <!-- Logo on the left -->
          <div style="flex: 1; display: flex; align-items: center; padding-left: 20px;"> <!-- Left padding added -->
            <img src="${header.logo}" alt="Logo" style="width: 140px; height: 67px; object-fit: contain;" />
          </div>

          <!-- PO Number & Date on the right -->
          <div style="flex: 1; text-align: right; padding-right: 20px;"> <!-- Padding on the right -->
            <p style="margin: 0; font-size: 16px;">Purchase Order: ${poNumber}</p>
            <p style="margin: 0; font-size: 14px;">Date: ${poDate}</p>
          </div>
        </div>

        <!-- Divider -->
        <hr style="border: 1px solid #000; margin: 10px 0;">

        <!-- Vendor and Ship To/Bill To Section with Padding and Aligned Headings -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-top: 20px; padding-left: 20px; padding-right: 20px;"> <!-- Added padding on both sides -->
          <!-- Vendor Section -->
          <div style="width: 50%; text-align: left;">
            <p style="font-weight: bold; margin: 0; font-size: 16px;">Vendor:</p> <!-- Increased font size -->
            <p style="margin: 0; font-size: 14px; padding-top: 5px;">${vendorAddress}</p> <!-- Vendor address with some padding -->
          </div>

          <!-- Ship To / Bill To Section -->
          <div style="width: 50%; text-align: left;">
            <p style="font-weight: bold; margin: 0; font-size: 16px;">Ship To & Bill To:</p> <!-- Increased font size and aligned to left -->
            <p style="margin: 0; font-size: 14px; padding-top: 5px;">${branchAddress}</p> <!-- Ship To address with some padding -->
          </div>
        </div>

               <!-- Another Divider -->
        <hr style="border: 1px solid #000; margin-top: 10px;">

        <!-- Padding after the address sections to add space before next section -->
        <div style="padding-top: 30px;"></div>

 
      </header>
    `;
  }

  // Default header for other document types
  const branchSection = sections.find((section: any) => section.title === "Branch Details");
  const branchAddress = branchSection ? branchSection.content.Address : "Address not available";

  return `
    <header style="display: flex; justify-content: space-between; align-items: flex-start; width: 94%; padding: 20px 0; box-sizing: border-box; margin-left: auto; margin-right: auto;">
      <div style="width: 140px; height: 67px; padding-top: 10px;">
        <img src="${header.logo}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;" />
      </div>
      <div style="flex-grow: 1; text-align: center;">
        <h1 style="margin: 0; font-size: 16px; text-decoration: underline; background: #5C5C5C; color: white; padding: 5px;">Bill of Supply & Tax Invoice</h1>
        <p style="margin: 10px 0 0 0; font-size: 20px; font-weight: bold; text-transform: uppercase;">Evara Health Pvt Ltd</p>
        <p style="margin: 0; font-size: 20px; font-weight: bold; text-transform: uppercase;">EVARA FERTILITY</p>
        <p style="margin: 10px 0 0 0; font-size: 16px;">${branchAddress}</p>
      </div>
      <div style="width: 140px;"></div>
    </header>
  `;
};

const generateFooterHtml = (): string => {
  const currentDate = new Date()
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/ /g, "-");

  return `
    <footer style="width: 94%; padding: 10px 0; font-size: 18px; color: grey; text-align: center; border-top: 2px solid #288BDB; margin-left: auto; margin-right: auto;">
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

export const main: SNSHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb();
    for (const record of event.Records) {
      const rawData = record.Sns.Message;

      const data: IReportData = JSON.parse(rawData);

      console.log("SNS Message", JSON.stringify(data, null, 2));

      let clinic = null;
      let patient = null;

      if (
        data.documentType === EDocumentTypes.PurchaseOrder ||
        EDocumentTypes.PurchaseOrderProcessed
      ) {
        clinic = await Clinic.findOne({ code: data.clinic }).lean();
        if (!clinic) {
          console.error("Clinic not found");
          return;
        }
      } else {
        patient = await Patient.findById(data.patient).lean();
        if (!patient) {
          console.error("Patient not found");
          return;
        }

        clinic = await Clinic.findOne({ code: data.clinic }).lean();
        if (!clinic) {
          console.error("Clinic not found");
          return;
        }
      }

      const logoUrl =
        "https://evara-hms-clinics-devs.s3.ap-south-1.amazonaws.com/Evara+new+logo+1.1.png";

      const logo = await getBase64ImageFromUrl(logoUrl);

      const header = {
        logo: logo,
        clinicName: clinic?.name,
        clinicAddress: `${clinic?.headOfficeAddress?.street}, ${clinic?.headOfficeAddress?.city}, ${clinic?.headOfficeAddress?.state}, ${clinic?.headOfficeAddress?.pincode}`,
        patientName: patient?.firstName + " " + patient?.lastName,
        patientId: patient?.patientId || patient?._id,
        doctorName: data.doctor,
        reportName: data.reportName,
      };

      const templateData = {
        header,
        sections: data.sections,
        fileName: data.documentType,

        styles: {
          primaryColor: "#FF5C00",
          secondaryColor: "#10535E",
        },
      };

      const template = await getHtmlTemplate(data.templateType);
      const htmlContent = generateHtml(template, templateData);

      const headerHtml = generateHeaderHtml(
        templateData.header,
        templateData.styles,
        templateData.sections,
        data.documentType
      );

      const footerHtml = generateFooterHtml(templateData.styles);
      const htmlContentWithBorders = generateHtmlWithContentBorders(htmlContent);

      const key = patient
        ? `${patient._id}/${data.documentType}/generated/${data.reportId}-${data.fileName}.pdf`
        : `${clinic._id}/${data.documentType}/generated/${data.reportId}-${data.fileName}.pdf`;

      const queueUrl = process.env.REPORT_PDF_GENERATION_QUEUE_URL;
      if (!queueUrl) {
        throw new Error("Environment variable 'REPORT_PDF_GENERATION_QUEUE_URL' is not set.");
      }

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

      const sqsParams: SQS.SendMessageRequest = {
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(pdfGeneratorMessage),
      };

      await SQSService.sendMessage(sqsParams);
    }
  } catch (error) {
    console.error(error);
  }
};
