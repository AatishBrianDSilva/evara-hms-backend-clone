import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";

import successResponse from "@evara-backend/core/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/lib/utils/errorMessage";
import PatientCryoPreservation from "@evara-backend/core/src/models/patientDashboard/cryoPreservation/PatientCryoPreservation";
import SNSService from "@evara-backend/core/src/lib/aws/sns";

export const main: APIGatewayProxyHandler = async (event, _context) => {
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

    const cryoPreservation = await PatientCryoPreservation.findByIdAndDelete(
      id
    );

    if (cryoPreservation) {
      const messagePayload = {
        action: "Delete",
        data: {
          serviceId: cryoPreservation._id,
        },
      };

      await SNSService.publishMessage({
        Message: JSON.stringify(messagePayload),
        TopicArn: process.env.BILLING_ESTIMATION_TOPIC_ARN,
      });
    } else {
      console.error("cryoPreservation not found");
    }

    return successResponse(
      "cryoPreservation Updated successfully",
      cryoPreservation
    );
  } catch (error) {
    return errorResponse(error);
  }
};
