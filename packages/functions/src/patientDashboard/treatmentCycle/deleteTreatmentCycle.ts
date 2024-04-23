import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";

import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import PatientTreatmentCycle from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/PatientTreatmentCycle";
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

    const treatmentCycle = await PatientTreatmentCycle.findByIdAndDelete(id);
    console.log("TreatmentCycle", treatmentCycle);

    if (treatmentCycle) {
      const messagePayload = {
        action: "Delete",
        data: {
          serviceId: treatmentCycle._id,
        },
      };

      await SNSService.publishMessage({
        Message: JSON.stringify(messagePayload),
        TopicArn: process.env.BILLING_ESTIMATION_TOPIC_ARN,
      });
    } else {
      console.error("Treatment Cycle not found");
    }

    return successResponse(
      "TreatmentCycle Updated successfully",
      treatmentCycle
    );
  } catch (error) {
    return errorResponse(error);
  }
};
