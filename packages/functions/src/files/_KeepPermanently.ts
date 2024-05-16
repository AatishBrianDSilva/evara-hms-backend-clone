import S3Service from "@evara-backend/core/src/lib/aws/s3";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";

export const S3KeepPermanently = async (bucket: string, key: string) => {
  try {
    const tags = [
      {
        Key: "Permanent",
        Value: "true",
      },
    ];

    console.log(`Keeping file permanently: ${bucket}/${key}`);

    await S3Service.putTag(bucket, key, tags);
  } catch (error) {
    console.error(error);
    throw new ErrorMessage(500, "Error keeping file permanently");
  }
};

interface S3UrlParts {
  bucketName: string;
  key: string;
}

export const parseS3Url = (url: string): S3UrlParts | null => {
  const regex =
    /^https:\/\/(.+?)\.s3\.(.+?)\.amazonaws\.com\/(.+?)\/(.+?)\/(.+)$/;
  const match = url.match(regex);

  if (!match) {
    return null;
  }

  const bucketName = match[1];
  const key = `${match[3]}/${match[4]}/${match[5]}`;

  return { bucketName, key };
};
