import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import { PurchaseOrder } from "@evara-backend/core/models/pharmacyDashboard/PurchaseOrder";
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import S3Service from "@evara-backend/core/src/lib/aws/s3";

// Handler function for downloading the purchase order invoice
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, "Unauthorized");
    }

    if (!event.pathParameters || !event.pathParameters.id) {
      throw new ErrorMessage(400, "Purchase Order ID is not provided");
    }

    const purchaseOrderId = event.pathParameters["id"];
    console.log("Purchase Order ID at API:", purchaseOrderId);

    await connectMongoDb();

    // Find the purchase order by ID
    const purchaseOrder = await PurchaseOrder.findOne({ _id: purchaseOrderId });

    if (!purchaseOrder) {
      throw new ErrorMessage(404, "Purchase Order does not exist");
    }

    // Extract the report field from the purchaseOrder
    const { reportProcessed } = purchaseOrder;
    if (!reportProcessed || !reportProcessed.bucket || !reportProcessed.key) {
      throw new ErrorMessage(404, "No report found for this Purchase Order");
    }

    const { bucket, key } = reportProcessed; // Fetch bucket and key from the report field
    console.log(`Bucket: ${bucket}, Key: ${key}`);

    // Retrieve the PDF data from S3 using the bucket and key
    const pdfData = await S3Service.getObject(bucket, key);
    if (!pdfData) {
      throw new ErrorMessage(404, "Invoice not found in S3");
    }

    // Return the PDF response
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=${purchaseOrder.poNumber}-invoice.pdf`,
      },
      body: pdfData,
      isBase64Encoded: true,
    };
  } catch (error) {
    return errorResponse(error);
  }
};
