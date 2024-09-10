import * as fs from "fs";
import * as path from "path";
import * as Handlebars from "handlebars";
import { SNSHandler } from "aws-lambda";
import * as SQS from "aws-sdk/clients/sqs";
import { formatToIndianCurrencyFormat } from "@evara-backend/core/src/lib/utils/formatToIndianCurrencyFormat"; // Adjust the path accordingly

import { IPDFGeneratorMessage, IReportData } from "@evara-backend/core/src/lib/types/global";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import Patient from "@evara-backend/core/src/models/Patients";
import Clinic from "@evara-backend/core/src/models/mastersDashboard/Clinic";
import SQSService from "@evara-backend/core/src/lib/aws/sqs";
import axios from "axios";

const TEMPLATE_PATH = path.resolve(__dirname, "../../../core/src/templates");
// const files = fs.readdirSync(templatesPath);
// console.log('Templates directory contents:', files);

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

    // Add a space before each capital letter (except the first one)
    str = str.replace(/([a-z])([A-Z])/g, "$1 $2");

    // Capitalize the first letter of each word
    return str.replace(/\b\w/g, (char) => char.toUpperCase());
  });

  // Register custom helpers for comparison
  Handlebars.registerHelper("lt", function (a, b) {
    return a < b;
  });

  Handlebars.registerHelper("gte", function (a, b) {
    return a >= b;
  });

  // Register helper to increment index
  Handlebars.registerHelper("inc", function (value) {
    return parseInt(value) + 1;
  });

  Handlebars.registerHelper("contains", function (str, substring) {
    return str && str.indexOf(substring) > -1;
  });

  const compiledTemplate = Handlebars.compile(template);
  return compiledTemplate(data);
};

const generateHeaderHtml = (header: any, styles: any): string => {
  // Check for undefined or empty strings for each value
  // const doctorInfo =
  //   header.doctorName &&
  //   header.doctorName !== "undefined undefined" &&
  //   header.doctorName !== "" &&
  //   header.doctorName !== " "
  //     ? `<p style="margin: 0;font-size: 14px;">Doctor: ${header.doctorName}</p>`
  //     : "";

  return `
    <header style="display: flex; justify-content: space-between; align-items: flex-start; width: 94%; padding: 20px 0; box-sizing: border-box; margin-left: auto; margin-right: auto;">

      <div style="width: 140px; height: 67px; padding-top: 10px;">
        <img src="${header.logo}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;" />
      </div>
      <div style="flex-grow: 1; text-align: center;">
        <h1 style="margin: 0; font-size: 16px; text-decoration: underline; background: #5C5C5C; color: white; padding: 5px;">Bill of Supply & Tax Invoice</h1>
        <p style="margin: 10px 0 0 0; font-size: 20px; font-weight: bold; text-transform: uppercase;">Evara Health Pvt Ltd</p>
        <p style="margin: 0; font-size: 20px; font-weight: bold; text-transform: uppercase;">EVARA FERTILITY</p>
        <p style="margin: 10px 0 0 0; font-size: 16px;">111/118, Ashok Nagar, Harsh Nagar, Kanpur, Uttar Pradesh 208001</p>
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
      Bill generated on ${currentDate} - evarahealth.com
    </footer>
  `;
};

const generateHtmlWithContentBorders = (bodyHtml: string): string => {
  return `
  
    <div style=" width: 100%;  box-sizing: border-box; padding: 0;">
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

      // Prepare data for template
      const patient = await Patient.findById(data.patient).lean();
      if (!patient) {
        console.error("Patient not found");
        return;
      }

      const clinic = await Clinic.findOne({ code: data.clinic }).lean();
      if (!clinic) {
        console.error("Clinic not found");
        return;
      }

      const logoUrl =
        "https://gv-evara-hms-user-profiles-dev.s3.ap-south-1.amazonaws.com/evara-logo.png";

      const logo = await getBase64ImageFromUrl(logoUrl);

      // console.log("Logo: ", logo);

      const header = {
        logo: logo,
        clinicName: clinic?.name,
        clinicAddress: `${clinic?.headOfficeAddress?.street}, ${clinic?.headOfficeAddress?.city}, ${clinic?.headOfficeAddress?.state}, ${clinic?.headOfficeAddress?.pincode}`,
        patientName: patient?.firstName + " " + patient?.lastName,
        patientId: patient?.patientId || patient?._id,
        doctorName: data.doctor,
        reportName: data.reportName,
      };

      // Prepare data for template
      const templateData = {
        header,
        sections: data.sections,
        styles: {
          primaryColor: "#FF5C00",
          secondaryColor: "#10535E",
        },
      };

      // console.log("Template Data: ", JSON.stringify(templateData, null, 2));

      const template = await getHtmlTemplate(data.templateType);
      const htmlContent = generateHtml(template, templateData);
      console.log("HTML Content: ", htmlContent);

      const headerHtml = generateHeaderHtml(templateData.header, templateData.styles);
      console.log("Header HTML: ", headerHtml);
      const footerHtml = generateFooterHtml(templateData.styles);
      console.log("Footer HTML: ", footerHtml);

      const htmlContentWithBorders = generateHtmlWithContentBorders(htmlContent);

      const key = `${patient._id}/${data.documentType}/generated/${data.reportId}-${data.fileName}.pdf`;
      console.log("Key: ", key);

      const queueUrl = process.env.REPORT_PDF_GENERATION_QUEUE_URL;
      if (!queueUrl) {
        throw new Error("Environment variable 'REPORT_PDF_GENERATION_QUEUE_URL' is not set.");
      }

      const pdfGeneratorMessage: IPDFGeneratorMessage = {
        headerHtml,
        footerHtml,
        htmlContent: htmlContentWithBorders, // Use the content with left and right borders
        bucket: data.bucket,
        key: key,
        patient: patient,
        doctor: data.doctor,
        category: data.documentType,
        reportName: data.reportName,
        source_report_id: data.reportId,
      };

      // Send message to SQS
      const sqsParams: SQS.SendMessageRequest = {
        QueueUrl: queueUrl, // Your SQS Queue URL
        MessageBody: JSON.stringify(pdfGeneratorMessage),
      };

      await SQSService.sendMessage(sqsParams);
    }
  } catch (error) {
    console.error(error);
  }
};
