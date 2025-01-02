import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import { PurchaseOrder } from '@evara-backend/core/models/pharmacyDashboard/PurchaseOrder';
import { extractAuthorizerDetails } from '@evara-backend/core/src/lib/utils/extractAuthorizerDetails';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import S3Service from '@evara-backend/core/src/lib/aws/s3';
import { ObjectId } from 'mongodb';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, 'Unauthorized');
    }

    const responseId = event.pathParameters?.id;
    const reportKey = event.queryStringParameters?.key
      ? decodeURIComponent(event.queryStringParameters.key)
      : null;

    if (!responseId) {
      throw new ErrorMessage(400, 'Response ID is not provided');
    }
    if (!reportKey) {
      throw new ErrorMessage(400, 'Report key is not provided');
    }

    console.log(`Received responseId: ${responseId}`);
    console.log(`Received reportKey: ${reportKey}`);

    await connectMongoDb();
    console.log('MongoDB connected successfully');

    // Find the purchase order by response ID
    const purchaseOrder = await PurchaseOrder.findOne({
      'responses._id': new ObjectId(responseId),
    });

    if (!purchaseOrder) {
      throw new ErrorMessage(404, 'Purchase Order does not exist');
    }

    console.log(`Found PurchaseOrder: ${JSON.stringify(purchaseOrder)}`);

    // Find the specific response
    const response = purchaseOrder.responses.find(
      (r: any) => r._id.toString() === responseId,
    );

    if (!response) {
      throw new ErrorMessage(404, 'Response does not exist in Purchase Order');
    }

    // Validate bucket
    const bucketName = response.report.bucket;
    console.log(`Using Bucket: ${bucketName}`);

    // Fetch the PDF data from S3
    const pdfData = await S3Service.getObject(bucketName, reportKey);

    if (!pdfData) {
      throw new ErrorMessage(404, 'Invoice not found in S3');
    }

    console.log(`Fetched PDF successfully for Key: ${reportKey}`);

    // Return the PDF response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=${purchaseOrder.poNumber}-response-${responseId}-invoice.pdf`,
      },
      body: pdfData,
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error('Error:', error);
    return errorResponse(error);
  }
};
