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
import SNSService from "@evara-backend/core/lib/aws/sns";
import {
  EBuckets,
  EDocumentTypes,
  EReportTemplateTypes,
  IInvoiceData,
  IReportData,
} from "@evara-backend/core/lib/types/global";
import _ from "lodash";
import { sanitizeInvoiceData } from "@evara-backend/core/lib/utils/sanitizeInvoiceData";

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

  // console.log("Event", event);
  // console.log("Context", _context);

  const session = await conn.startSession();
  session.startTransaction();
  try {
    if (!event.body) {
      throw new ErrorMessage(400, "Data is required");
    }

    const data: BillingsData = JSON.parse(event.body);

    const results = [];

    console.log("Data", data);

    for (const { billingId, payments } of data.billings) {
      if (!billingId || !payments) {
        throw new ErrorMessage(400, "Billing ID and payments are required for each entry");
      }

      const billing = await PatientBilling.findById(billingId).session(session);
      if (!billing) {
        throw new ErrorMessage(404, `Billing not found for ID: ${billingId}`);
      }

      let totalPaid = billing.payments.reduce((acc, payment) => acc + payment.amount, 0);
      let totalPaymentAttempt = payments.reduce((acc, payment) => acc + payment.amount, 0);
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
          paymentDate: payment.paymentDate ? new Date(payment.paymentDate) : new Date(),
          details: payment.details,
          type: EPaitentBillingPaymentType.Payment,
        });
        // console.log("Current Payment", payment);
      });

      console.log("Payments", payments);

      // Generate Report for payment
      if (payments) {
        const report = processDataForReport(payments, billingId, data, billing);
        console.log("Report Data: ", JSON.stringify(report, null, 2));

        // Send to SNS
        await SNSService.publishMessage({
          Message: JSON.stringify(report),
          TopicArn: process.env.REPORT_HTML_GENERATION_TOPIC_ARN,
        });
      }

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

const processDataForReport = (data: any, id: string, patientData: any, billing: any) => {
  const reportData: IInvoiceData = {
    bucket: EBuckets.UserReports,
    documentType: EDocumentTypes.Invoice,
    templateType: EReportTemplateTypes.Invoices,
    patient: patientData.patientData,
    clinic: patientData.patientData.clinicId,
    sections: [],
    reportName: "",
    fileName: "invoice",
    reportId: id,
  };

  console.log("Billing", billing);

  const billItems = billing.items.map((item: any) => ({
    serviceName: item.serviceName,
    serviceType: item.serviceType,
    quantity: item.quantity,
    price: item.price,
    amount: item.amount,
    tax: item.tax,
    total: item.total,
  }));

  const billDetails = {
    items: billItems,
    subTotal: billing.subTotal,
    discount: billing.discount,
    tax: billing.tax,
    grandTotal: billing.grandTotal,
    totalPaid: billing.totalPaid,
    totalPaymentAttempts: billing.totalPaymentAttempts,
    totalDues: billing.totalDues,
  };

  const sections = [
    {
      title: "Items",
      showTitle: true,
      isBillDetails: true, // Add this flag to identify the section
      content: billItems,
    },
    {
      title: "Summary",
      showTitle: true,
      isBillDetails: false,
      content: {
        "Payment Method": data.length > 0 ? data[0].method : "",

        "Sub Total": billing.subTotal,
        Tax: billing.tax,
        Discount: billing.discount,
        "Grand Total": billing.grandTotal,
      },
    },
    // Add other sections as needed
    console.log("Bill Items", billItems),
  ];

  // console.log("New Data Structure", newData);

  reportData.reportName = `Invoice ${billing.billingId}`;
  // reportData.sections = [...generateSections(newData)];
  reportData.sections = sanitizeInvoiceData(sections);

  return reportData;
};
