import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import {
  PatientBilling,
  EPatientBillingStatus,
  EPaitentBillingPaymentType,
} from '@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling';

const round = (num: number) => Math.round(num * 100) / 100;

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  await connectMongoDb();

  try {
    if (!event.pathParameters) {
      throw new ErrorMessage(400, 'Path parameters are null');
    }

    const id = event.pathParameters['id'];
    if (!id) {
      throw new ErrorMessage(400, 'Id is not provided');
    }

    if (event.body == null) {
      throw new ErrorMessage(400, 'Data is required');
    }

    const { refundAmount, method, refundDate } = JSON.parse(event.body);

    if (typeof refundAmount !== 'number' || refundAmount <= 0) {
      throw new ErrorMessage(400, 'Invalid refund amount');
    }

    // Validate and round refundAmount
    const roundedRefundAmount = round(refundAmount);
    if (typeof roundedRefundAmount !== 'number' || roundedRefundAmount <= 0) {
      throw new ErrorMessage(400, 'Invalid refund amount');
    }

    const billing = await PatientBilling.findById(id);
    if (!billing) {
      throw new ErrorMessage(404, 'Billing not found');
    }

    // Ensure the refund does not exceed the total paid or the total refundable
    const totalPaid = billing.payments.reduce(
      (acc, payment) => acc + payment.amount,
      0,
    );
    if (roundedRefundAmount > totalPaid) {
      throw new ErrorMessage(400, 'Refund amount exceeds the amount paid');
    }

    // Process the refund as a negative payment
    billing.payments.push({
      amount: round(-roundedRefundAmount),
      method: method,
      paymentDate: refundDate ? new Date(refundDate) : new Date(),
      type: EPaitentBillingPaymentType.Refund,
    });

    // Update billing status if necessary
    if (round(totalPaid - roundedRefundAmount) === 0) {
      billing.status = EPatientBillingStatus.Refunded;
    } else {
      // billing.status = EPatientBillingStatus.PartiallyRefunded;
    }

    await billing.save();

    return successResponse('Refund processed successfully');
  } catch (error) {
    return errorResponse(error);
  }
};
