import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import PatientReports from "@evara-backend/core/src/models/patientDashboard/PatientReports";
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import S3Service from "@evara-backend/core/src/lib/aws/s3";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, "Unauthorized");
    }

    if (event.pathParameters === null) {
      throw new ErrorMessage(400, "Path parameters are null");
    }

    // Safely access the id property
    const id = event.pathParameters["id"];
    if (!id) {
      throw new ErrorMessage(400, "Id is not provided");
    }

    await connectMongoDb();

    const report = await PatientReports.findOne({ source_report_id: id });
    if (!report) {
      throw new ErrorMessage(404, "Report does not exist");
    }

    console.log("Report", report);

    const { bucket, key } = report;

    const pdfData = await S3Service.getObject(bucket, key);
    if (!pdfData) {
      throw new ErrorMessage(404, "Report not found");
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=${report.source_report_id}-${report.reportName}`,
      },
      body: pdfData,
    };
  } catch (error) {
    return errorResponse(error);
  }
};
