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

    const key = generateObjectKey(bucket, userId, documentType);

    const url = await S3Service.generatePresignedUrl(
      bucket,
      key,
      expires,
      operation
    );

    return successResponse("Presigned URL generated successfully", { url });
  } catch (error) {
    return errorResponse(error);
  }
};

function generateObjectKey(
  bucket: string,
  userId: string,
  documentType?: string
): string {
  switch (bucket) {
    case "user-profiles":
      return `profile-images/${userId}/profile.jpg`; // Assuming one profile image per user
    case "user-reports":
      if (!documentType) {
        throw new Error("Document type is required for user-reports bucket.");
      }
      return `reports/${userId}/${documentType}/${new Date().toISOString()}.pdf`; // Using timestamp to ensure unique filenames
    default:
      throw new Error("Invalid bucket name.");
  }
}
