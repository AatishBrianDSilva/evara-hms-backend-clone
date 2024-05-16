import { APIGatewayProxyHandler } from "aws-lambda";

import S3Service from "@evara-backend/core/src/lib/aws/s3";

import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    if (!event.body) {
      throw new ErrorMessage(400, "No data provided");
    }

    const { bucket, key } = JSON.parse(event.body);

    if (!bucket || !key) {
      throw new ErrorMessage(
        400,
        "Missing parameters: 'bucket' and 'key' are required"
      );
    }

    await S3Service.deleteObject(bucket, key);

    return successResponse("File deleted successfully");
  } catch (error) {
    return errorResponse(error);
  }
};
