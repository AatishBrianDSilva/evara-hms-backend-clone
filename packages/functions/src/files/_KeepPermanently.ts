import S3Service from "@evara-backend/core/src/lib/aws/s3";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";

export const keepPermanently = async (bucket: string, key: string) => {
  try {
    const tags = [
      {
        Key: "Permanent",
        Value: "true",
      },
    ];

    await S3Service.putTag(bucket, key, tags);
  } catch (error) {
    throw new ErrorMessage(500, "Error keeping file permanently");
  }
};
