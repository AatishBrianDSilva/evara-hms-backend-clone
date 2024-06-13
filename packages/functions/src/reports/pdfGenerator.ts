import puppeteer, { Browser } from "puppeteer-core";
import chromium from "@sparticuz/chromium";

import { SQSHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import PatientReport from "@evara-backend/core/src/models/patientDashboard/PatientReports";
import PatientInvoice from "@evara-backend/core/src/models/patientDashboard/PatientInvoices";
import S3Service from "@evara-backend/core/src/lib/aws/s3";
import { S3 } from "aws-sdk";
import { EDocumentTypes, IPDFGeneratorMessage } from "@evara-backend/core/src/lib/types/global";

chromium.setHeadlessMode = true;
chromium.setGraphicsMode = true;

const convertHtmlToPdf = async (html: string, header: string, footer: string): Promise<Buffer> => {
  const STAGE = process.env.STAGE;
  console.log("STAGE", STAGE);

  let browser: Browser;
  if (STAGE === "ratan") {
    browser = await puppeteer.launch({
      executablePath: "/Applications/Chromium.app/Contents/MacOS/Chromium",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: false,
    });
    console.log("browser", browser);
  } else if (STAGE === "aatishbrian") {
    browser = await puppeteer.launch({
      executablePath: "C:/Users/Brian D'Silva/OneDrive/Desktop/chrome-win/chrome.exe",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: false,
    });
    console.log("browser", browser);
  } else {
    const tmp = await chromium.executablePath();
    console.log("tmp path", tmp);
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    console.log("browser", browser);
  }

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  const pdf = await page.pdf({
    format: "A4",
    margin: {
      top: "200px",
      bottom: "200px",
      left: "25px",
      right: "25px",
    },
    printBackground: true,
    headerTemplate: header,
    footerTemplate: footer,
    displayHeaderFooter: true,
  });
  await browser.close();
  return pdf;
};

export const main: SQSHandler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  try {
    await connectMongoDb();
    for (const record of event.Records) {
      const {
        htmlContent,
        bucket,
        key,
        patient,
        doctor,
        category,
        reportName,
        source_report_id,
        headerHtml,
        footerHtml,
      }: IPDFGeneratorMessage = JSON.parse(record.body);

      const pdfBuffer = await convertHtmlToPdf(htmlContent, headerHtml, footerHtml);

      // Upload PDF to S3
      const s3Params: S3.PutObjectRequest = {
        Bucket: `${bucket}-${process.env.STAGE}`,
        Key: key,
        Body: pdfBuffer,
        ContentType: "application/pdf",
        Tagging: `Permanent=true`,
      };

      await S3Service.upload(s3Params);

      if (category !== EDocumentTypes.Invoice) {
        await PatientReport.findOneAndUpdate(
          { source_report_id },
          {
            clinicId: patient.clinicId,
            branchId: patient.branchId,
            doctor: doctor,
            patient: patient._id,
            category: category,
            reportName: reportName,
            bucket: s3Params.Bucket,
            key: s3Params.Key,
          },
          { upsert: true }
        );
      } else {
        await PatientInvoice.findOneAndUpdate(
          { source_report_id },
          {
            clinicId: patient.clinicId,
            branchId: patient.branchId,
            doctor: doctor,
            patient: patient._id,
            category: category,
            reportName: reportName,
            bucket: s3Params.Bucket,
            key: s3Params.Key,
          },
          { upsert: true }
        );
      }

      console.log("PDF generated and uploaded successfully.");
    }
  } catch (err) {
    console.error(err);
  }
};
