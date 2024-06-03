import { APIGatewayProxyHandler } from "aws-lambda";

import S3Service from "@evara-backend/core/src/lib/aws/s3";
import {
  EDocumentTypes,
  EBuckets,
} from "@evara-backend/core/src/lib/types/global";

import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    if (!event.body) {
      throw new ErrorMessage(400, "No data provided");
    }

    const { bucket, userId, documentType, operation, expires } = JSON.parse(
      event.body
    );

    if (!bucket || !userId || !operation) {
      throw new ErrorMessage(
        400,
        "Missing parameters: 'bucket', 'userId', and 'operation' are required"
      );
    }

    const validOperations = ["putObject", "getObject"];
    if (!validOperations.includes(operation)) {
      throw new ErrorMessage(
        400,
        "Invalid operation. Use 'putObject' or 'getObject'."
      );
    }

    console.log({
      bucket,
      userId,
      documentType,
      operation,
      expires,
    });

    const key = generateObjectKey(bucket, userId, documentType);

    const region = process.env.REGION;
    const stage = process.env.STAGE;
    if (!stage) {
      throw new ErrorMessage(500, "Environment variable 'STAGE' is not set.");
    }

    const bucketName = `${bucket}-${stage}`;

    const filePublic = EBuckets.UserProfiles === bucket;

    console.log(`Bucket: ${bucketName}`);
    console.log(`Key: ${key}`);
    console.log(`Expires: ${expires}`);
    console.log(`Operation: ${operation}`);
    console.log(`Region: ${region}`);
    console.log(`File public: ${filePublic}`);

    const url = await S3Service.generatePresignedUrl(
      bucketName,
      key,
      expires,
      operation,
      filePublic
    );

    console.log(`Presigned URL generated for ${operation} operation`);

    console.log(`URL: ${url}`);

    return successResponse("Presigned URL generated successfully", {
      url,
      bucketName,
      key,
      region,
    });
  } catch (error) {
    return errorResponse(error);
  }
};

function generateObjectKey(
  bucket: string,
  userId: string,
  documentType?: EDocumentTypes
): string {
  switch (bucket) {
    case EBuckets.UserProfiles:
      return `profile-images/${userId}/profile.jpg`; // Assuming one profile image per user
    case EBuckets.UserReports:
      if (!documentType) {
        throw new Error("Document type is required for user-reports bucket.");
      }
      return `${userId}/${documentType}/uploaded/${new Date().toISOString()}.pdf`; // Using timestamp to ensure unique filenames
    default:
      throw new Error("Invalid bucket name.");
  }
}
