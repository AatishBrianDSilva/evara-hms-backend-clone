import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import Appointments from "@evara-backend/core/src/models/Appointments";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";
import PatientTreatmentCycle from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/PatientTreatmentCycle";
import { PatientBilling } from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling";
import { PatientRefund } from "@evara-backend/core/models/patientDashboard/Billings/PatientRefund";

export interface IDateRange {
  startDate: Date;
  endDate: Date;
}

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, "Unauthorized");
    }
    // Connect to MongoDB
    await connectMongoDb();

    // Extract query string parameters
    const params = event.queryStringParameters || {};
    const { startDate, endDate } = params;
    console.log("New Params", params);

    const dateRange: IDateRange = {
      startDate: new Date(),
      endDate: new Date(),
    };

    if (startDate) {
      dateRange.startDate = new Date(startDate);
    }
    if (endDate) {
      dateRange.endDate = new Date(endDate);
    }

    const [appointmentData, treatmentData, billingData, pharmacyData] =
      await Promise.all([
        getAppointmentSummary(dateRange, auth.clinicId!, auth.branchId!),
        getTreatmentsSummary(dateRange, auth.clinicId!),
        getBillingsSummary(dateRange, auth.clinicId!, auth.branchId!),
        getPharmacySummary(dateRange, auth.clinicId!, auth.branchId!),
      ]);

    return successResponse("Success", {
      appointment: appointmentData,
      treatment: treatmentData,
      billing: billingData,
      pharmacy: pharmacyData,
    });
  } catch (error) {
    return errorResponse(error);
  }
};

const getAppointmentSummary = async (
  dateRange: IDateRange,
  clinicId: string,
  branchId: string
) => {
  const statusMap = {
    Scheduled: { color: "info", label: "Scheduled" },
    Reported: { color: "warning", label: "Reported" },
    Completed: { color: "success", label: "Completed" },
    Cancelled: { color: "error", label: "Cancelled" },
  };

  const data = await Appointments.aggregate([
    {
      $match: {
        clinicId,
        branchId,
        date: {
          $gte: dateRange.startDate,
          $lte: dateRange.endDate,
        },
      },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: null,
        statuses: {
          $push: {
            status: "$_id",
            count: "$count",
          },
        },
        total: { $sum: "$count" },
      },
    },
  ]);

  const dataResult = data.length > 0 ? data[0] : { statuses: [], total: 0 };

  const badges = Object.keys(statusMap).map((status) => {
    const found = dataResult.statuses.find((d) => d.status === status);
    return {
      color: statusMap[status].color,
      count: found ? found.count : 0,
      label: statusMap[status].label,
    };
  });

  const response = {
    total: dataResult.total,
    badges,
  };

  return response;
};

const getTreatmentsSummary = async (
  dateRange: IDateRange,
  clinicId: string
) => {
  const statusMap = {
    Scheduled: { color: "info", label: "Scheduled" },
    "In-Progress": { color: "warning", label: "In-Progress" },
    Completed: { color: "success", label: "Completed" },
    Pending: { color: "error", label: "Pending" },
  };

  const data = await PatientTreatmentCycle.aggregate([
    {
      $match: {
        clinicId,
        date: {
          $gte: dateRange.startDate,
          $lte: dateRange.endDate,
        },
      },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: null,
        statuses: {
          $push: {
            status: "$_id",
            count: "$count",
          },
        },
        total: { $sum: "$count" },
      },
    },
  ]);

  const dataResult = data.length > 0 ? data[0] : { statuses: [], total: 0 };

  const badges = Object.keys(statusMap).map((status) => {
    const found = dataResult.statuses.find((d) => d.status === status);
    return {
      color: statusMap[status].color,
      count: found ? found.count : 0,
      label: statusMap[status].label,
    };
  });

  const response = {
    total: dataResult.total,
    badges,
  };

  return response;
};

const getBillingsSummary = async (
  dateRange: IDateRange,
  clinicId: string,
  branchId: string
) => {
  const statusMap = {
    Paid: { color: "success", label: "Paid" },
    Unpaid: { color: "warning", label: "Pending" },
    Discount: { color: "primary", label: "Discount" },
    Refunded: { color: "error", label: "Refunded" },
  };

  const paymentMethodColorMap: Record<string, string> = {
    Cash: "info",
    UPI: "warning",
    Online: "success",
    CreditCard: "error",
    BankTransfer: "info",
  };

  // Fetch total refunded data from PatientRefund collection
  const refundData = await PatientRefund.aggregate([
    {
      $match: {
        clinicId,
        branchId,
        "refundDetails.refundDate": {
          $gte: dateRange.startDate,
          $lte: dateRange.endDate,
        },
      },
    },
    {
      $group: {
        _id: "$refundDetails.method", // Group by refund method
        totalRefunded: { $sum: "$refundDetails.refundAmount" }, // Sum refunded amounts
        count: { $sum: 1 }, // Count number of refunds
      },
    },
    {
      $group: {
        _id: null,
        totalRefunded: { $sum: "$totalRefunded" }, // Sum refunded amounts
        count: { $sum: "$count" }, // Total number of refunds
        refundedByMethod: {
          $push: {
            method: "$_id",
            amount: "$totalRefunded",
            count: "$count",
          }, // Push method, amount, and count for each refund method
        },
      },
    },
  ]);

  console.log("Refund Data", JSON.stringify(refundData, null, 2));

  const totalRefunded = refundData.length > 0 ? refundData[0].totalRefunded : 0;

  const amountByRefundMethod =
    refundData.length > 0 ? refundData[0].refundedByMethod : [];

  // Aggregation for total billings, discount, and refunded amounts
  const data = await PatientBilling.aggregate([
    {
      $match: {
        clinicId,
        branchId,
        createdAt: {
          $gte: dateRange.startDate,
          $lte: dateRange.endDate,
        },
      },
    },
    {
      $group: {
        _id: "$status", // Group by status (Paid, Pending, etc.)
        totalBillings: { $sum: { $add: ["$amount", "$tax"] } }, // Sum of amount + tax
        totalDiscount: { $sum: "$discount" }, // Total discount
        totalRefunded: { $sum: "$totalRefunded" }, // Total refunded
        count: { $sum: 1 }, // Count number of records
      },
    },
  ]);

  console.log("Billing Data", data);

  const dataResult = data.find((item) => item._id === "Paid") || {
    statuses: [],
    total: 0,
    totalBillings: 0,
    totalDiscount: 0,
    totalRefunded: 0,
  };

  const finalTotalBillings = dataResult.totalBillings;

  const paidAmount = finalTotalBillings - dataResult.totalDiscount;

  // Aggregation for payment methods, ensuring no double counting
  const paymentData = await PatientBilling.aggregate([
    {
      $match: {
        clinicId,
        branchId,
        createdAt: {
          $gte: dateRange.startDate,
          $lte: dateRange.endDate,
        },
        status: "Paid",
      },
    },
    {
      $unwind: "$payments",
    }, // Unwind payments array to break down by payment method
    {
      $group: {
        _id: {
          billingId: "$_id", // Group by billing ID first to avoid double counting
          method: "$payments.method", // Group by payment method (Cash, UPI, etc.)
        },
        totalPaidPerBilling: { $sum: "$payments.amount" }, // Sum payments for each billing document
      },
    },
    {
      $group: {
        _id: "$_id.method", // Now group by payment method
        totalPaid: { $sum: "$totalPaidPerBilling" }, // Sum payments per method, across billing documents
      },
    },
  ]);

  console.log("Payment Data", JSON.stringify(paymentData, null, 2));

  // Process the payment methods and their totals
  const paymentMethods = {
    Cash: 0,
    UPI: 0,
    Online: 0,
    CreditCard: 0,
    BankTransfer: 0,
  };

  const refundMethods = {
    Cash: 0,
    UPI: 0,
    Online: 0,
    CreditCard: 0,
    BankTransfer: 0,
  };

  for (const refund of amountByRefundMethod) {
    if (refund.method === "Cash") {
      refundMethods.Cash += refund.amount;
    } else if (refund.method === "UPI") {
      refundMethods.UPI += refund.amount;
    } else if (refund.method === "Online") {
      refundMethods.Online += refund.amount;
    } else if (refund.method === "CreditCard") {
      refundMethods.CreditCard += refund.amount;
    } else if (refund.method === "BankTransfer") {
      refundMethods.BankTransfer += refund.amount;
    }
  }

  paymentData.forEach((payment) => {
    if (paymentMethods.hasOwnProperty(payment._id)) {
      paymentMethods[payment._id] = payment.totalPaid; // Sum totalPaid only once per method
    }
  });

  // Prepare badges for payment methods
  const paymentBadges = Object.keys(paymentMethods).map((method) => ({
    color: paymentMethodColorMap[method] || "primary",
    count: (paymentMethods[method] - refundMethods[method]).toFixed(2),
    label: method,
  }));

  // Status badges for Paid, Pending, Discount, and Refunded
  const statusBadges = [
    {
      color: statusMap.Paid.color,
      count: paidAmount.toFixed(2),
      label: statusMap.Paid.label,
    },
    {
      color: statusMap.Unpaid.color,
      count: "0.00", // Pending can be set based on logic if available
      label: statusMap.Unpaid.label,
    },
    {
      color: statusMap.Discount.color,
      count: dataResult.totalDiscount.toFixed(2),
      label: statusMap.Discount.label,
    },
    {
      color: statusMap.Refunded.color,
      count: totalRefunded.toFixed(2), // Use the total refunded from PatientRefund
      label: statusMap.Refunded.label,
    },
  ];

  const totalPaid = Object.values(paymentMethods).reduce(
    (acc, value) => acc + value,
    0
  );

  // Ensure total paid does not exceed total billings (adjusting for overpayments)
  const adjustedTotalPaid = Math.min(totalPaid, finalTotalBillings);

  const response = {
    total: dataResult.count,
    badges: [...statusBadges, ...paymentBadges], // Include all badges (status + payment method)
    totalBillings: (paidAmount - parseFloat(totalRefunded)).toFixed(2), // Total billings after discount and refund
    totalPaid: parseFloat(adjustedTotalPaid.toFixed(2)), // Adjust total paid to avoid exceeding total billings
    totalDiscount: dataResult.totalDiscount, // Total discount
    totalRefunded: totalRefunded, // Total refunded amount from PatientRefund
  };

  console.log("Response:", response);

  return response;
};

const getPharmacySummary = async (
  dateRange: IDateRange,
  clinicId: string,
  branchId: string
) => {
  const data = await PatientBilling.aggregate([
    {
      $match: {
        clinicId,
        branchId,
        billType: "Pharmacy", // Only include Pharmacy bills
        status: "Paid", // Only include paid bills
        createdAt: {
          $gte: dateRange.startDate,
          $lte: dateRange.endDate,
        },
      },
    },
    {
      $group: {
        _id: null,
        totalAmountSum: {
          $sum: {
            $subtract: [
              {
                $add: [
                  { $ifNull: ["$amount", 0] }, // Ensure amount exists
                  { $ifNull: ["$tax", 0] }, // Ensure tax exists
                ],
              },
              { $ifNull: ["$discount", 0] }, // Ensure discount exists
            ],
          },
        },
        totalRefundedSum: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$refundDetails.refundDate", dateRange.startDate] },
                  { $lte: ["$refundDetails.refundDate", dateRange.endDate] },
                ],
              },
              { $ifNull: ["$totalRefunded", 0] },
              0,
            ],
          },
        }, // Sum of total refund
      },
    },
  ]);

  // Ensure correct rounding and handling
  const totalAmount =
    data.length > 0
      ? parseFloat(
          (data[0].totalAmountSum - data[0].totalRefundedSum).toFixed(2)
        )
      : 0;

  const response = {
    totalAmount: totalAmount, // Return the final total
  };

  return response;
};
