import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import {
  PatientBilling,
  EPatientBillingStatus,
  EPaymentMethod,
} from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling";

interface BillingsData {
  billings: {
    billingId: string; // ID of the billing
    payments: {
      amount: number;
      method: EPaymentMethod;
      paymentDate?: string;
    }[];
  }[]; // Array of billing items
}

export const main: APIGatewayProxyHandler = async (event, _context) => {
  await connectMongoDb();

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

      const billing = await PatientBilling.findById(billingId);
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

      if (totalPaymentAttempt + totalPaid < billing.grandTotal) {
        throw new ErrorMessage(
          400,
          `Payment insufficient to clear dues for billing ID: ${billingId}`
        );
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

      if (totalPaymentAttempt + totalPaid >= billing.grandTotal) {
        billing.status = EPatientBillingStatus.Paid;
      }

      await billing.save();
      results.push({ billingId: billingId, status: "Processed" });
    }

    return successResponse("All billings processed successfully", results);
  } catch (error) {
    return errorResponse(error);
  }
};
