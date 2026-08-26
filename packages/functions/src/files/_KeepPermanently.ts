import S3Service from '@evara-backend/core/src/lib/aws/s3';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';

export const S3KeepPermanently = async (bucket: string, key: string) => {
  try {
    const tags = [
      {
        Key: 'Permanent',
        Value: 'true',
      },
    ];

    console.log(`Keeping file permanently: ${bucket}/${key}`);

    await S3Service.putTag(bucket, key, tags);
  } catch (error) {
    console.error(error);
    throw new ErrorMessage(500, 'Error keeping file permanently');
  }
};

interface S3UrlParts {
  bucketName: string;
  key: string;
}

export const parseS3Url = (url: string): S3UrlParts | null => {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Virtual-hosted-style: https://{bucket}.s3.{region}.amazonaws.com/{key}
  const regex = /^https:\/\/(.+?)\.s3\.(.+?)\.amazonaws\.com\/(.+)$/;
  const match = url.match(regex);

  if (match) {
    const bucketName = match[1];
    // Strip query string (presigned URLs) and decode path segments
    const rawKey = match[3].split('?')[0];
    const key = decodeURIComponent(rawKey);

    return { bucketName, key };
  }

  return null;
};

/** Tag one or more stored S3 object URLs as Permanent so the 15-min sweeper skips them. */
export const keepUrlsPermanently = async (urls: unknown) => {
  const list = Array.isArray(urls) ? urls : urls ? [urls] : [];

  for (const url of list) {
    if (!url || typeof url !== 'string' || url.length === 0) {
      continue;
    }
    const s3UrlParts = parseS3Url(url);
    if (!s3UrlParts) {
      throw new ErrorMessage(400, `Invalid file URL: ${url}`);
    }
    await S3KeepPermanently(s3UrlParts.bucketName, s3UrlParts.key);
  }
};
