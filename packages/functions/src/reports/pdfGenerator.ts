import puppeteer, { Browser } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

import { SQSHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import PatientReport from '@evara-backend/core/src/models/patientDashboard/PatientReports';
import PatientInvoice from '@evara-backend/core/src/models/patientDashboard/PatientInvoices';
import S3Service from '@evara-backend/core/src/lib/aws/s3';
import { S3 } from 'aws-sdk';
import {
  EDocumentTypes,
  IPDFGeneratorMessage,
} from '@evara-backend/core/src/lib/types/global';
import { PurchaseOrder } from '@evara-backend/core/models/pharmacyDashboard/PurchaseOrder';

chromium.setHeadlessMode = true;
chromium.setGraphicsMode = true;

const convertHtmlToPdf = async (
  html: string,
  header: string,
  footer: string,
): Promise<Buffer> => {
  const STAGE = process.env.STAGE;
  console.log('STAGE', STAGE);

  let browser: Browser;
  if (STAGE === 'ratan') {
    browser = await puppeteer.launch({
      executablePath: '/Applications/Chromium.app/Contents/MacOS/Chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: false,
    });
    console.log("Browser launched for stage 'ratandeeparunkumar'");
  } else if (STAGE === 'aatishbrian') {
    browser = await puppeteer.launch({
      executablePath:
        "C:/Users/Brian D'Silva/OneDrive/Desktop/chrome-win/chrome.exe",
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: false,
    });
    console.log("Browser launched for stage 'aatishbrian'");
  } else {
    const tmp = await chromium.executablePath();
    console.log('tmp path', tmp);
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    console.log('Chromium browser launched for other stages');
  }

  const page = await browser.newPage();
  console.log('New browser page created');
  await page.setContent(html, { waitUntil: 'networkidle0' });
  console.log('HTML content set for PDF generation');

  const pdf = await page.pdf({
    format: 'A4',
    margin: {
      top: '120px',
      bottom: '100px',
      left: '25px',
      right: '25px',
    },
    printBackground: true,
    headerTemplate: header,
    footerTemplate: footer,
    displayHeaderFooter: true,
  });
  console.log('PDF generated');
  await browser.close();
  return pdf;
};

export const main: SQSHandler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  try {
    console.log('Starting main handler');
    await connectMongoDb();
    console.log('MongoDB connection established');

    for (const record of event.Records) {
      console.log('Processing SQS record:', record);

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

      console.log('Received data for report generation:', {
        patient,
        category,
        reportName,
        source_report_id,
      });

      const pdfBuffer = await convertHtmlToPdf(
        htmlContent,
        headerHtml,
        footerHtml,
      );

      // Upload PDF to S3
      const s3Params: S3.PutObjectRequest = {
        Bucket:
          process.env.STAGE === 'prod'
            ? `${bucket}-${process.env.STAGE}`
            : `${bucket}-devs`,
        Key: key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
        Tagging: `Permanent=true`,
      };

      await S3Service.upload(s3Params);
      console.log(`PDF uploaded to S3 at ${s3Params.Bucket}/${s3Params.Key}`);

      if (category !== EDocumentTypes.Invoice && patient) {
        console.log('Updating PatientReport for report ID:', source_report_id);

        // Check if `patient` is an ID (string) or an object
        const patientId =
          typeof patient === 'object' && patient._id ? patient._id : patient;

        const updatedPatientReport = await PatientReport.findOneAndUpdate(
          { source_report_id },
          {
            clinicId: patient.clinicId,
            branchId: patient.branchId,
            doctor: doctor,
            patient: patientId,
            category: category,
            reportName: reportName,
            bucket: s3Params.Bucket,
            key: s3Params.Key,
          },
          { upsert: true, new: true },
        );
        console.log('Patient report updated:', updatedPatientReport);
      } else if (category === EDocumentTypes.Invoice && patient) {
        console.log('Updating PatientInvoice for report ID:', source_report_id);
        const updatedPatientInvoice = await PatientInvoice.findOneAndUpdate(
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
          { upsert: true, new: true },
        );
        console.log('Patient invoice updated:', updatedPatientInvoice);
      } else if (!patient && category === EDocumentTypes.PurchaseOrder) {
        console.log('Handling purchase order report for ID:', source_report_id);
        const purchaseOrder = await PurchaseOrder.findOne({
          poNumber: source_report_id,
        });

        if (purchaseOrder) {
          purchaseOrder.report = {
            reportName: reportName,
            bucket: s3Params.Bucket,
            key: s3Params.Key,
          };
          await purchaseOrder.save();
          console.log(
            `Purchase order ${source_report_id} updated with report.`,
          );
        } else {
          console.error(
            `Purchase order with poNumber ${source_report_id} not found.`,
          );
        }
      } else if (
        !patient &&
        category === EDocumentTypes.PurchaseOrderProcessed
      ) {
        console.log(
          'Handling processed purchase order report for ID:',
          source_report_id,
        );
        const purchaseOrder = await PurchaseOrder.findOne({
          poNumber: source_report_id,
        });

        if (purchaseOrder) {
          purchaseOrder.reportProcessed = {
            reportName: reportName,
            bucket: s3Params.Bucket,
            key: s3Params.Key,
          };
          await purchaseOrder.save();
          console.log(
            `Processed purchase order ${source_report_id} updated with report.`,
          );
        } else {
          console.error(
            `Purchase order with poNumber ${source_report_id} not found.`,
          );
        }
      }

      console.log('PDF generated and uploaded successfully.');
    }
  } catch (err) {
    console.error('Error occurred during PDF processing:', err);
  }
};
