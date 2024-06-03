import * as fs from "fs";
import * as path from "path";
import * as Handlebars from "handlebars";
import { SNSHandler } from "aws-lambda";
import * as SQS from "aws-sdk/clients/sqs";

import {
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
  return fs.promises.readFile(templatePath, "utf8");
};

const generateHtml = (template: string, data: any): string => {
  const compiledTemplate = Handlebars.compile(template);
  return compiledTemplate(data);
};

const generateHeaderHtml = (header: any, styles: any): string => {
  return `
    <header style="color: ${styles.primaryColor}; padding: 5mm; display: inline-block; width: 100%; margin: 1cm 1cm; border-bottom: 1mm solid ${styles.secondaryColor}">
      <div style="float: left; width: 25%;">
        <img src="${header.logo}" alt="Logo" style="width: 80px; height: 80px; border: 1px solid ${styles.primaryColor}; border-radius: 50%;" />
      </div>
      <div style="float: left; width: 50%; text-align: center; word-wrap: break-word;">
        <h1 style="margin: 0;font-size: 36px;">${header.clinicName}</h1>
        <p style="margin: 0;font-size: 14px;">${header.clinicAddress}</p>
      </div>
      <div style="float: right; width: 25%; text-align: right;">
        <p style="margin: 0;font-size: 14px;">ID: ${header.patientId}</p>
        <p style="margin: 0;font-size: 14px;">Patient: ${header.patientName}</p>
        <p style="margin: 0;font-size: 14px;">Doctor: ${header.doctorName}</p>
      </div>
    </header>
  `;
};

const generateFooterHtml = (styles: any): string => {
  return `
  <footer style="width: 100%; display: inline-block; margin: 1cm 1cm; border-top: 1mm solid ${styles.secondaryColor}; font-size: 10px; color: grey;  text-align: center;  padding: 10px; ">
      Page <span class="pageNumber"></span> of <span class="totalPages"></span>
  </footer>
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
        "https://www.adaptivewfs.com/wp-content/uploads/2020/07/logo-placeholder-image.png";

      const logo = await getBase64ImageFromUrl(logoUrl);
      console.log("Logo: ", logo);

      const header = {
        logo: logo,
        clinicName: clinic?.name,
        clinicAddress: `${clinic?.headOfficeAddress?.street}, ${clinic?.headOfficeAddress?.city}, ${clinic?.headOfficeAddress?.state}, ${clinic?.headOfficeAddress?.pincode}`,
        patientName: patient?.firstName + " " + patient?.lastName,
        patientId: patient?.patientId,
        doctorName: data.doctor,
        reportName: data.reportName,
      };

      // Prepare data for template
      const templateData = {
        header,
        sections: data.sections,
        styles: {
          primaryColor: "#FF5C00",
          secondaryColor: "#5981DE",
        },
      };

      // console.log("Template Data: ", JSON.stringify(templateData, null, 2));

      const template = await getHtmlTemplate(data.templateType);
      const htmlContent = generateHtml(template, templateData);
      console.log("HTML Content: ", htmlContent);

      const headerHtml = generateHeaderHtml(
        templateData.header,
        templateData.styles
      );
      console.log("Header HTML: ", headerHtml);
      const footerHtml = generateFooterHtml(templateData.styles);
      console.log("Footer HTML: ", footerHtml);

      const key = `${patient._id}/${data.documentType}/generated/${data.reportId}-${data.fileName}.pdf`;
      console.log("Key: ", key);

      const queueUrl = process.env.REPORT_PDF_GENERATION_QUEUE_URL;
      if (!queueUrl) {
        throw new Error(
          "Environment variable 'REPORT_PDF_GENERATION_QUEUE_URL' is not set."
        );
      }

      const pdfGeneratorMessage: IPDFGeneratorMessage = {
        headerHtml,
        footerHtml,
        htmlContent,
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
