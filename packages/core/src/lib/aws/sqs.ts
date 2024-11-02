import { SQS } from 'aws-sdk';

const sqs = new SQS({
  region: 'ap-south-1',
});

class SQSService {
  static async sendMessage(params: AWS.SQS.SendMessageRequest) {
    try {
      const data = await sqs.sendMessage(params).promise();
      return data;
    } catch (e: any) {
      throw new Error(`error : ${e.message}`);
    }
  }

  static async deleteMessage(queueURL: string, receiptHandle: string) {
    try {
      const params: AWS.SQS.DeleteMessageRequest = {
        QueueUrl: queueURL,
        ReceiptHandle: receiptHandle,
      };
      const data = await sqs.deleteMessage(params).promise();
      return data;
    } catch (e: any) {
      throw new Error(`error : ${e.message}`);
    }
  }
}

export default SQSService;
