import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import PatientPackage from "@evara-backend/core/models/patientDashboard/packages/PatientPackage";
import SNSService from "@evara-backend/core/src/lib/aws/sns";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb();

    if (event.pathParameters === null) {
      throw new ErrorMessage(400, "Path parameters are null");
    }

    // Safely access the id property
    const id = event.pathParameters["id"];
    if (!id) {
      throw new ErrorMessage(400, "Id is not provided");
    }

    const packageData = await PatientPackage.findByIdAndDelete(id);
    console.log("Package", packageData);

    if (packageData) {
      const messagePayload = {
        action: "Delete",
        data: {
          serviceId: packageData._id,
        },
      };

      // await SNSService.publishMessage({
      //   Message: JSON.stringify(messagePayload),
      //   TopicArn: process.env.BILLING_ESTIMATION_TOPIC_ARN,
      // });
    } else {
      console.error("Package not found");
    }

    return successResponse("Package deleted successfully", packageData);
  } catch (error) {
    return errorResponse(error);
  }
};
