import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";

import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import PatientProcedures from "@evara-backend/core/src/models/patientDashboard/procedure/PatientProcedure";
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

    const procedure = await PatientProcedures.findByIdAndDelete(id);
    console.log("Procedure", procedure);

    if (procedure) {
      const messagePayload = {
        action: "Delete",
        data: {
          serviceId: procedure._id,
        },
      };

      await SNSService.publishMessage({
        Message: JSON.stringify(messagePayload),
        TopicArn: process.env.BILLING_ESTIMATION_TOPIC_ARN,
      });
    } else {
      console.error("Procedure not found");
    }

    return successResponse("Procedure Updated successfully", procedure);
  } catch (error) {
    return errorResponse(error);
  }
};
