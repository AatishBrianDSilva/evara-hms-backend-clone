import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import { PharmacyInvoice } from "@evara-backend/core/models/pharmacyDashboard/PharmacyInvoice";
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
    console.log("id at api", id);
    if (!id) {
      throw new ErrorMessage(400, "Id is not provided");
    }

    await connectMongoDb();

    // Find the pharmacy invoice by id
    const invoice = await PharmacyInvoice.findById(id);
    if (!invoice) {
      throw new ErrorMessage(404, "Invoice does not exist");
    }

    const { bucket, key } = invoice;

    console.log("Bucket", bucket);
    console.log("key", key);

    // Retrieve the PDF data from S3
    const pdfData = await S3Service.getObject(bucket, key);
    if (!pdfData) {
      throw new ErrorMessage(404, "Invoice not found");
    }

    // Return the PDF data as a downloadable attachment
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=${invoice}`,
      },
      body: pdfData,
      isBase64Encoded: true,
    };
  } catch (error) {
    return errorResponse(error);
  }
};
