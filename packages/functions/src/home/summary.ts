import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import Appointments from "@evara-backend/core/src/models/Appointments";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";
import PatientTreatmentCycle from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/PatientTreatmentCycle";
import { PatientBilling } from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling";

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

    const [appointmentData, treatmentData, billingData, pharmacyData] = await Promise.all([
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

const getAppointmentSummary = async (dateRange: IDateRange, clinicId: string, branchId: string) => {
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

const getTreatmentsSummary = async (dateRange: IDateRange, clinicId: string) => {
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

const getBillingsSummary = async (dateRange: IDateRange, clinicId: string, branchId: string) => {
  const statusMap = {
    Paid: { color: "success", label: "Paid" },
    Unpaid: { color: "warning", label: "Pending" },
  };

  const paymentMethodColorMap: Record<string, string> = {
    Cash: "info",
    UPI: "warning",
    Online: "success",
    CreditCard: "error",
    BankTransfer: "info",
  };

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
      $unwind: {
        path: "$payments",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmount: { $sum: { $add: ["$amount", "$tax"] } }, // Sum of amount + tax
        totalDiscount: { $sum: "$discount" },
        totalPaid: { $sum: "$payments.amount" },
        totalRefunded: { $sum: "$totalRefunded" },
        paymentsByMethod: {
          $push: {
            method: "$payments.method",
            amount: "$payments.amount",
          },
        },
      },
    },
    {
      $group: {
        _id: null,
        statuses: {
          $push: {
            status: "$_id",
            count: "$count",
            totalAmount: { $sum: "$totalAmount" }, // Total amount per status (already calculated)
          },
        },
        total: { $sum: "$count" },
        totalBillings: { $sum: "$totalAmount" },
        totalDiscount: { $sum: "$totalDiscount" },
        totalPaid: { $sum: "$totalPaid" },
        totalRefunded: { $sum: "$totalRefunded" },
        paymentsByMethod: { $push: "$paymentsByMethod" },
      },
    },
  ]);

  const paymentMethods = {};

  if (data.length > 0) {
    data[0].paymentsByMethod.forEach((payments) => {
      payments.forEach((payment) => {
        if (!paymentMethods[payment.method]) {
          paymentMethods[payment.method] = 0;
        }
        paymentMethods[payment.method] += payment.amount;
      });
    });
  }

  const dataResult =
    data.length > 0
      ? data[0]
      : {
          statuses: [],
          total: 0,
          totalBillings: 0,
          totalPaid: 0,
          totalDiscount: 0,
          totalRefunded: 0,
        }; // Initialize totalRefunded

  const finalTotalBillings = dataResult.totalBillings; // Total billings is already calculated as amount - refunded

  const paymentBadges = Object.keys(paymentMethods).map((method) => ({
    color: paymentMethodColorMap[method] || "primary",
    count: paymentMethods[method].toFixed(2),
    label: method,
  }));

  // Update status badges to reflect the total amounts for Paid and Pending
  const statusBadges = dataResult.statuses.map((status) => {
    return {
      color: statusMap[status.status]?.color || "primary",
      count: status.totalAmount.toFixed(2), // Show total amount instead of count
      label: statusMap[status.status]?.label || status.status,
    };
  });

  const response = {
    total: dataResult.total,
    badges: [...statusBadges, ...paymentBadges], // Include updated status badges with payment badges
    totalBillings: finalTotalBillings,
    totalPaid: dataResult.totalPaid - dataResult.totalRefunded, // Subtract refunds from total paid
    totalDiscount: dataResult.totalDiscount,
    totalRefunded: dataResult.totalRefunded,
  };

  return response;
};

const getPharmacySummary = async (dateRange: IDateRange, clinicId: string, branchId: string) => {
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
        totalRefundedSum: { $sum: { $ifNull: ["$totalRefunded", 0] } }, // Sum of total refunded
      },
    },
  ]);

  // Ensure correct rounding and handling
  const totalAmount =
    data.length > 0
      ? parseFloat((data[0].totalAmountSum - data[0].totalRefundedSum).toFixed(2))
      : 0;

  const response = {
    totalAmount: totalAmount, // Return the final total
  };

  return response;
};
