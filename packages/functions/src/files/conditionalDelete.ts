import S3Service from "@evara-backend/core/src/lib/aws/s3";
import { SQSEvent, Context } from "aws-lambda";

export const main = async (event: SQSEvent, context: Context) => {
  for (const record of event.Records) {
    const { bucket, key } = JSON.parse(record.body);

    console.log("Processing record", { bucket, key });

    try {
      const tags = await S3Service.getTags(bucket, key);
      console.log("Tags", tags);

      const isPermanent = tags.some(
        (tag) => tag.Key === "Permanent" && tag.Value === "true"
      );

      if (!isPermanent) {
        console.log(`Deleting object: ${key}`);
        await S3Service.deleteObject(bucket, key);
      } else {
        console.log(`Skipping deletion for permanent object: ${key}`);
      }
    } catch (err) {
      const error = err as Error;
      console.log(`Error processing record: ${error.message}`, {
        bucket,
        key,
        requestId: context.awsRequestId,
      });
      // console.error(`Error processing record: ${error.message}`, {
      //   bucket,
      //   key,
      //   requestId: context.awsRequestId,
      // });
    }
  }
};
