import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import {
  EPatientBillingEstimationStatus,
  PatientBillingEstimation,
} from "@evara-backend/core/models/patientDashboard/Billings/PatientBillingEstimation";
import {
  EPatientBillingStatus,
  PatientBilling,
} from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  await connectMongoDb();

  try {
    // Connect to MongoDB

    if (!event.pathParameters) {
      throw new ErrorMessage(400, "Path parameters are null");
    }

    const id = event.pathParameters["id"];
    if (!id) {
      throw new ErrorMessage(400, "Id is not provided");
    }

    if (event.body == null) {
      throw new ErrorMessage(400, "Data is required");
    }

    const { payments } = JSON.parse(event.body);

    const billing = await PatientBilling.findById(id);
    if (!billing) {
      throw new ErrorMessage(404, "Billing not found");
    }

    for (const payment of payments) {
      billing.payments.push({
        amount: payment.amount,
        method: payment.method,
        paymentDate: payment.paymentDate
          ? new Date(payment.paymentDate)
          : new Date(),
      });
    }

    const totalPaid = billing.payments.reduce(
      (acc, payment) => acc + payment.amount,
      0
    );

    if (totalPaid >= billing.grandTotal) {
      billing.status = EPatientBillingStatus.Paid; // Update status to 'Paid' if full amount is covered
    }

    await billing.save();

    return successResponse("Billing processed successfully");
  } catch (error) {
    return errorResponse(error);
  }
};
