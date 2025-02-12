import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import { InternalConsumption } from '@evara-backend/core/models/pharmacyDashboard/InternalConsumption';
import { extractAuthorizerDetails } from '@evara-backend/core/src/lib/utils/extractAuthorizerDetails';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import S3Service from '@evara-backend/core/src/lib/aws/s3';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, 'Unauthorized');
    }

    if (!event.pathParameters) {
      throw new ErrorMessage(400, 'Path parameters are missing');
    }

    const id = event.pathParameters['id'];
    if (!id) {
      throw new ErrorMessage(400, 'Internal Consumption ID is not provided');
    }

    await connectMongoDb();

    // Find the internal consumption record by ID
    const internalConsumption = await InternalConsumption.findById(id);

    if (!internalConsumption) {
      throw new ErrorMessage(404, 'Internal Consumption record does not exist');
    }

    const { report } = internalConsumption;
    if (!report || !report.bucket || !report.key) {
      throw new ErrorMessage(
        404,
        'Report for this internal consumption is not available',
      );
    }

    // Retrieve the PDF report data from S3
    const pdfData = await S3Service.getObject(report.bucket, report.key);
    if (!pdfData) {
      throw new ErrorMessage(404, 'Report not found in S3');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=internal-consumption-${internalConsumption.icNumber}.pdf`,
      },
      body: pdfData,
      isBase64Encoded: true,
    };
  } catch (error) {
    return errorResponse(error);
  }
};
