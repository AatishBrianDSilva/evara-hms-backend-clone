import SQSService from '@evara-backend/core/src/lib/aws/sqs';
import { S3Event, SQSMessageAttributes } from 'aws-lambda';

export const main = async (event: S3Event) => {
  const delaySeconds = 15 * 60;
  const queueUrl = process.env.S3_SCHEDULE_DELETE_QUEUE_URL;

  if (!queueUrl) {
    throw new Error(
      "Environment variable 'S3_SCHEDULE_DELETE_QUEUE_URL' is not set.",
    );
  }

  for (const record of event.Records) {
    const params: AWS.SQS.SendMessageRequest = {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({
        bucket: record.s3.bucket.name,
        key: record.s3.object.key,
      }),
      DelaySeconds: delaySeconds,
    };

    await SQSService.sendMessage(params);
  }
};
