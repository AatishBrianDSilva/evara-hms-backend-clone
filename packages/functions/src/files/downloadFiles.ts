import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import PatientInvestigation from "@evara-backend/core/models/patientDashboard/investigation/PatientInvestigation"; // Update this path as needed
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import S3Service from "@evara-backend/core/src/lib/aws/s3";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, "Unauthorized");
    }

    if (!event.body) {
      throw new ErrorMessage(400, "Data is required");
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    await connectMongoDb();

    console.log("fileUrl", data.fileUrl);
    if (!data.fileUrl) {
      throw new ErrorMessage(404, "No file found for this investigation");
    }

    const url = new URL(data.fileUrl);
    const bucket = url.hostname.split(".")[0];
    const key = decodeURIComponent(url.pathname.slice(1)); // Ensure URL decoding
    const fileName = key.split("/").pop();
    console.log("bucket", bucket);
    console.log("key", key);
    console.log("fileName", fileName);

    const fileData = await S3Service.getObject(bucket, key);
    console.log("fileData", fileData);
    if (!fileData) {
      throw new ErrorMessage(404, "File not found");
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
      // body: fileData.Body.toString("base64"),
      body: fileData,
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error("Error:", error);
    return errorResponse(error);
  }
};
