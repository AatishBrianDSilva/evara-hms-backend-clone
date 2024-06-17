import { APIGatewayProxyHandler } from "aws-lambda";

import S3Service from "@evara-backend/core/src/lib/aws/s3";
import { EDocumentTypes, EBuckets } from "@evara-backend/core/src/lib/types/global";

import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    if (!event.body) {
      throw new ErrorMessage(400, "No data provided");
    }

    const { bucket, userId, documentType, operation, expires, fileName, isImage, reportId } =
      JSON.parse(event.body);

    if (!bucket || !userId || !operation) {
      throw new ErrorMessage(
        400,
        "Missing parameters: 'bucket', 'userId', and 'operation' are required"
      );
    }

    const validOperations = ["putObject", "getObject"];
    if (!validOperations.includes(operation)) {
      throw new ErrorMessage(400, "Invalid operation. Use 'putObject' or 'getObject'.");
    }

    console.log({
      bucket,
      userId,
      documentType,
      operation,
      expires,
      isImage,
    });

    const key = generateObjectKey(bucket, userId, fileName, isImage, documentType, reportId);

    const region = process.env.REGION;
    const stage = process.env.STAGE;
    if (!stage) {
      throw new ErrorMessage(500, "Environment variable 'STAGE' is not set.");
    }

    const bucketName = `${bucket}-${stage}`;

    const filePublic = isImage === true || bucket === EBuckets.PharmacyInvoices;

    // console.log("****");

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
  fileName: string,
  isImage: boolean,
  documentType?: EDocumentTypes,
  reportId?: string
): string {
  switch (bucket) {
    case EBuckets.UserProfiles:
      return `profile-images/${userId}/profile.jpg`; // Assuming one profile image per user
    case EBuckets.UserReports:
      if (!documentType || !reportId) {
        throw new Error("Document type and reportId is required for user-reports bucket.");
      }
      if (isImage) {
        return `${userId}/${documentType}/${reportId}/uploaded/images/${fileName}`; // Using timestamp to ensure unique filenames
      }
      return `${userId}/${documentType}/${reportId}/uploaded/${fileName}`; // Using timestamp to ensure unique filenames

    case EBuckets.PharmacyInvoices:
      if (!documentType) {
        throw new Error("Document type is required for user-invoices bucket.");
      }
      return `${userId}/${documentType}/uploaded/${fileName}`;
    // return `${userId}/${documentType}/${reportId}/uploaded/${fileName}`;

    default:
      throw new Error("Invalid bucket name.");
  }
}
