import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import successResponse from "@evara-backend/core/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/errorMessage";
import { PatientBilling } from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling";
import {
  PatientBillingEstimation,
  EPatientBillingEstimationStatus,
} from "@evara-backend/core/models/patientDashboard/Billings/PatientBillingEstimation";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  const conn = await connectMongoDb();
  const session = await conn.startSession();
  session.startTransaction();

  try {
    if (event.pathParameters === null) {
      throw new ErrorMessage(400, "Path parameters are null");
    }

    const id = event.pathParameters["id"];
    if (!id) {
      throw new ErrorMessage(400, "Id is not provided");
    }

    // Find the billing to get associated estimations
    const billing = await PatientBilling.findById(id).session(session);
    if (!billing) {
      throw new ErrorMessage(404, "Billing not found");
    }

    // Retrieve all estimation IDs from the billing items (assuming they are stored with estimation IDs)
    const estimationIds = billing.items.map((item) => item.estimationId);

    // Delete the billing document
    await PatientBilling.findByIdAndDelete(id, { session });

    // Revert the status of all linked estimations to 'Active'
    await Promise.all(
      estimationIds.map((estimationId) =>
        PatientBillingEstimation.findByIdAndUpdate(
          estimationId,
          { status: EPatientBillingEstimationStatus.Active },
          { session }
        )
      )
    );

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();
    return successResponse(
      "Billing deleted and estimations reverted successfully"
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return errorResponse(error);
  }
};
