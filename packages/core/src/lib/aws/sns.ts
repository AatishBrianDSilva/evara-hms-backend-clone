import { SNS } from "aws-sdk";

const sns = new SNS({
  region: "ap-south-1",
});

class SNSService {
  /**
   * Publishes a message to an SNS topic.
   * @param params The message and topic configuration.
   */
  static async publishMessage(params: AWS.SNS.PublishInput) {
    try {
      const data = await sns.publish(params).promise();
      return data;
    } catch (e: any) {
      throw new Error(`Error: ${e.message}`);
    }
  }

  /**
   * This function is a placeholder to illustrate handling other potential operations such as unsubscribing.
   * @param subscriptionArn The ARN of the subscription.
   */
  static async unsubscribe(subscriptionArn: string) {
    try {
      const params: AWS.SNS.UnsubscribeInput = {
        SubscriptionArn: subscriptionArn,
      };
      const data = await sns.unsubscribe(params).promise();
      return data;
    } catch (e: any) {
      throw new Error(`Error: ${e.message}`);
    }
  }
}

export default SNSService;
