import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import {
  PatientBilling,
  EPatientBillingStatus,
  EPaymentMethod,
  EPaitentBillingPaymentType,
} from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling";

interface BillingsData {
  billings: {
    billingId: string;
    payments: {
      amount: number;
      method: EPaymentMethod;
      paymentDate?: string;
      details?: string;
    }[];
  }[];
}

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const conn = await connectMongoDb();

  const session = await conn.startSession();
  session.startTransaction();
  try {
    if (!event.body) {
      throw new ErrorMessage(400, "Data is required");
    }

    const data: BillingsData = JSON.parse(event.body);

    const results = [];

    for (const { billingId, payments } of data.billings) {
      if (!billingId || !payments) {
        throw new ErrorMessage(
          400,
          "Billing ID and payments are required for each entry"
        );
      }

      const billing = await PatientBilling.findById(billingId).session(session);
      if (!billing) {
        throw new ErrorMessage(404, `Billing not found for ID: ${billingId}`);
      }

      let totalPaid = billing.payments.reduce(
        (acc, payment) => acc + payment.amount,
        0
      );
      let totalPaymentAttempt = payments.reduce(
        (acc, payment) => acc + payment.amount,
        0
      );
      let newTotalPaid = totalPaid + totalPaymentAttempt;

      if (newTotalPaid < billing.grandTotal) {
        throw new ErrorMessage(
          400,
          `Payment insufficient to clear dues for billing ID: ${billingId}`
        );
      }

      payments.forEach((payment) => {
        billing.payments.push({
          amount: payment.amount,
          method: payment.method,
          paymentDate: payment.paymentDate
            ? new Date(payment.paymentDate)
            : new Date(),
          details: payment.details,
          type: EPaitentBillingPaymentType.Payment,
        });
      });

      billing.status =
        newTotalPaid >= billing.grandTotal
          ? EPatientBillingStatus.Paid
          : EPatientBillingStatus.Pending;

      await billing.save({ session });
      results.push({ billingId: billingId, status: "Processed" });
    }

    await session.commitTransaction();
    session.endSession();

    return successResponse("All billings processed successfully", results);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return errorResponse(error);
  }
};
