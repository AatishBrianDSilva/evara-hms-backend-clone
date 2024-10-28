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

// const getBillingsSummary = async (
//   dateRange: IDateRange,
//   clinicId: string,
//   branchId: string
// ) => {
//   const statusMap = {
//     Paid: { color: "success", label: "Paid" },
//     Unpaid: { color: "warning", label: "Pending" },
//     Discount: { color: "primary", label: "Discount" },
//     Refunded: { color: "error", label: "Refunded" },
//   };

//   const paymentMethodColorMap: Record<string, string> = {
//     Cash: "info",
//     UPI: "warning",
//     Online: "success",
//     CreditCard: "error",
//     BankTransfer: "info",
//   };

//   // Step 1: Fetch refund data from PatientRefund collection
//   const refundData = await PatientRefund.aggregate([
//     {
//       $match: {
//         clinicId,
//         branchId,
//         "refundDetails.refundDate": {
//           $gte: dateRange.startDate,
//           $lte: dateRange.endDate,
//         },
//       },
//     },
//     {
//       $unwind: "$refundDetails",
//     },
//     {
//       $group: {
//         _id: "$refundDetails.method",
//         totalRefunded: { $sum: "$refundDetails.refundAmount" },
//       },
//     },
//   ]);

//   // Process refund data
//   const refundMethods = {
//     Cash: 0,
//     UPI: 0,
//     Online: 0,
//     CreditCard: 0,
//     BankTransfer: 0,
//   };

//   let totalRefunded = 0;

//   refundData.forEach((refund) => {
//     if (refundMethods.hasOwnProperty(refund._id)) {
//       refundMethods[refund._id] = refund.totalRefunded;
//       totalRefunded += refund.totalRefunded;
//     }
//   });

//   // Step 2: Aggregate billing data with payment details and discounts
//   const billingData = await PatientBilling.aggregate([
//     {
//       $match: {
//         clinicId,
//         branchId,
//         createdAt: {
//           $gte: dateRange.startDate,
//           $lte: dateRange.endDate,
//         },
//       },
//     },
//     {
//       $addFields: {
//         totalDueBeforeDiscount: { $add: ["$amount", "$tax"] },
//         totalDue: { $subtract: [{ $add: ["$amount", "$tax"] }, "$discount"] },
//       },
//     },
//     {
//       $unwind: { path: "$payments", preserveNullAndEmptyArrays: true },
//     },
//     {
//       $group: {
//         _id: "$_id",
//         totalDue: { $first: "$totalDue" },
//         totalDueBeforeDiscount: { $first: "$totalDueBeforeDiscount" },
//         totalDiscount: { $first: "$discount" },
//         totalPaid: { $sum: "$payments.amount" },
//       },
//     },
//     {
//       $lookup: {
//         from: "patientrefunds",
//         localField: "_id",
//         foreignField: "billingId",
//         as: "refunds",
//       },
//     },
//     {
//       $unwind: { path: "$refunds", preserveNullAndEmptyArrays: true },
//     },
//     {
//       $unwind: {
//         path: "$refunds.refundDetails",
//         preserveNullAndEmptyArrays: true,
//       },
//     },
//     {
//       $group: {
//         _id: "$_id",
//         totalDue: { $first: "$totalDue" },
//         totalDueBeforeDiscount: { $first: "$totalDueBeforeDiscount" },
//         totalDiscount: { $first: "$totalDiscount" },
//         totalPaid: { $first: "$totalPaid" },
//         totalRefunded: { $sum: "$refunds.refundDetails.refundAmount" },
//       },
//     },
//     {
//       $addFields: {
//         netPaid: { $subtract: ["$totalPaid", "$totalRefunded"] },
//       },
//     },
//     {
//       $addFields: {
//         amountPending: {
//           $cond: [
//             { $lte: ["$netPaid", 0] },
//             0,
//             { $subtract: ["$totalDue", "$netPaid"] },
//           ],
//         },
//       },
//     },
//   ]);

//   // Step 3: Aggregate totals
//   const totals = billingData.reduce(
//     (acc, bill) => {
//       acc.totalBillings += bill.totalDueBeforeDiscount;
//       acc.totalDiscount += bill.totalDiscount;
//       acc.totalPaid += bill.totalPaid;
//       acc.totalRefunded += bill.totalRefunded;
//       acc.totalPending += bill.amountPending;
//       return acc;
//     },
//     {
//       totalBillings: 0,
//       totalDiscount: 0,
//       totalPaid: 0,
//       totalRefunded: 0,
//       totalPending: 0,
//     }
//   );

//   // Step 4: Process payment methods
//   const paymentData = await PatientBilling.aggregate([
//     {
//       $match: {
//         clinicId,
//         branchId,
//         createdAt: {
//           $gte: dateRange.startDate,
//           $lte: dateRange.endDate,
//         },
//       },
//     },
//     {
//       $unwind: "$payments",
//     },
//     {
//       $group: {
//         _id: "$payments.method",
//         totalPaid: { $sum: "$payments.amount" },
//       },
//     },
//   ]);

//   const paymentMethods = {
//     Cash: 0,
//     UPI: 0,
//     Online: 0,
//     CreditCard: 0,
//     BankTransfer: 0,
//   };

//   paymentData.forEach((payment) => {
//     if (paymentMethods.hasOwnProperty(payment._id)) {
//       paymentMethods[payment._id] = payment.totalPaid;
//     }
//   });

//   // Adjust payment methods for refunds
//   Object.keys(paymentMethods).forEach((method) => {
//     const refundAmount = refundMethods[method] || 0;
//     paymentMethods[method] = paymentMethods[method] - refundAmount;
//   });

//   // Step 5: Prepare payment badges
//   const paymentBadges = Object.keys(paymentMethods).map((method) => ({
//     color: paymentMethodColorMap[method] || "primary",
//     count: paymentMethods[method].toFixed(2),
//     label: method,
//   }));

//   // Step 6: Prepare status badges
//   const statusBadges = [
//     {
//       color: statusMap.Paid.color,
//       count: (totals.totalPaid - totals.totalRefunded).toFixed(2),
//       label: statusMap.Paid.label,
//     },
//     {
//       color: statusMap.Unpaid.color,
//       count: totals.totalPending.toFixed(2),
//       label: statusMap.Unpaid.label,
//     },
//     {
//       color: statusMap.Discount.color,
//       count: totals.totalDiscount.toFixed(2),
//       label: statusMap.Discount.label,
//     },
//     {
//       color: statusMap.Refunded.color,
//       count: totals.totalRefunded.toFixed(2),
//       label: statusMap.Refunded.label,
//     },
//   ];

//   // Step 7: Construct response
//   const response = {
//     total: billingData.length,
//     badges: [...statusBadges, ...paymentBadges],
//     totalBillings: (
//       totals.totalBillings -
//       totals.totalDiscount -
//       totals.totalRefunded
//     ).toFixed(2),
//     totalPaid: parseFloat((totals.totalPaid - totals.totalRefunded).toFixed(2)),
//     totalDiscount: totals.totalDiscount.toFixed(2),
//     totalRefunded: totals.totalRefunded.toFixed(2),
//     totalPending: totals.totalPending.toFixed(2),
//   };

//   console.log("Response:", response);

//   return response;
// };

const getBillingsSummary = async (
  dateRange: IDateRange,
  clinicId: string,
  branchId: string
) => {
  // Initialize status and payment method maps
  const statusMap = {
    Paid: { color: "success", label: "Paid" },
    Unpaid: { color: "warning", label: "Pending" },
    Discount: { color: "primary", label: "Discount" },
    Refunded: { color: "error", label: "Refunded" },
  };

  const paymentMethodColorMap = {
    Cash: "info",
    UPI: "warning",
    Online: "success",
    CreditCard: "error",
    BankTransfer: "info",
  };

  // Step 1: Aggregate payments by method
  const paymentData = await PatientBilling.aggregate([
    {
      $match: {
        clinicId: clinicId,
        branchId: branchId,
        createdAt: {
          $gte: dateRange.startDate,
          $lte: dateRange.endDate,
        },
      },
    },
    {
      $unwind: "$payments",
    },
    {
      $group: {
        _id: "$payments.method",
        totalPaid: { $sum: "$payments.amount" },
      },
    },
  ]);

  // Step 2: Aggregate refunds by method
  const refundData = await PatientRefund.aggregate([
    {
      $match: {
        clinicId: clinicId,
        branchId: branchId,
        "refundDetails.refundDate": {
          $gte: dateRange.startDate,
          $lte: dateRange.endDate,
        },
      },
    },
    {
      $unwind: "$refundDetails",
    },
    {
      $group: {
        _id: "$refundDetails.method",
        totalRefunded: { $sum: "$refundDetails.refundAmount" },
      },
    },
  ]);

  // Step 3: Combine payment and refund data per method
  const methods = {
    Cash: { totalPaid: 0, totalRefunded: 0 },
    UPI: { totalPaid: 0, totalRefunded: 0 },
    Online: { totalPaid: 0, totalRefunded: 0 },
    CreditCard: { totalPaid: 0, totalRefunded: 0 },
    BankTransfer: { totalPaid: 0, totalRefunded: 0 },
  };

  // Populate totalPaid per method
  paymentData.forEach((payment) => {
    if (methods.hasOwnProperty(payment._id)) {
      methods[payment._id].totalPaid = payment.totalPaid;
    }
  });

  // Populate totalRefunded per method
  refundData.forEach((refund) => {
    if (methods.hasOwnProperty(refund._id)) {
      methods[refund._id].totalRefunded = refund.totalRefunded;
    }
  });

  // Calculate net amounts per method
  Object.keys(methods).forEach((method) => {
    methods[method].netAmount =
      methods[method].totalPaid - methods[method].totalRefunded;
  });

  // Step 4: Aggregate billing data with payment details and discounts
  const billingData = await PatientBilling.aggregate([
    {
      $match: {
        clinicId: clinicId,
        branchId: branchId,
        createdAt: {
          $gte: dateRange.startDate,
          $lte: dateRange.endDate,
        },
      },
    },
    {
      $addFields: {
        totalDueBeforeDiscount: { $add: ["$amount", "$tax"] },
        totalDue: { $subtract: [{ $add: ["$amount", "$tax"] }, "$discount"] },
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
        _id: "$_id",
        totalDue: { $first: "$totalDue" },
        totalDueBeforeDiscount: { $first: "$totalDueBeforeDiscount" },
        totalDiscount: { $first: "$discount" },
        totalPaid: { $sum: "$payments.amount" },
      },
    },
    {
      $lookup: {
        from: "patientrefunds", // Adjust collection name if necessary
        localField: "_id",
        foreignField: "billingId",
        as: "refunds",
      },
    },
    {
      $unwind: {
        path: "$refunds",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$refunds.refundDetails",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $group: {
        _id: "$_id",
        totalDue: { $first: "$totalDue" },
        totalDueBeforeDiscount: { $first: "$totalDueBeforeDiscount" },
        totalDiscount: { $first: "$totalDiscount" },
        totalPaid: { $first: "$totalPaid" },
        totalRefunded: { $sum: "$refunds.refundDetails.refundAmount" },
      },
    },
    {
      $addFields: {
        netPaid: { $subtract: ["$totalPaid", "$totalRefunded"] },
      },
    },
    {
      $addFields: {
        amountPending: {
          $cond: [
            { $lte: ["$netPaid", 0] },
            0,
            { $subtract: ["$totalDue", "$netPaid"] },
          ],
        },
      },
    },
  ]);

  // Step 5: Aggregate totals across all bills
  const totals = billingData.reduce(
    (acc, bill) => {
      acc.totalBillings += bill.totalDueBeforeDiscount;
      acc.totalDiscount += bill.totalDiscount;
      acc.totalPaid += bill.totalPaid;
      acc.totalRefunded += bill.totalRefunded;
      acc.totalPending += bill.amountPending;
      return acc;
    },
    {
      totalBillings: 0,
      totalDiscount: 0,
      totalPaid: 0,
      totalRefunded: 0,
      totalPending: 0,
    }
  );

  // Step 6: Prepare payment badges
  const paymentBadges = Object.keys(methods).map((method) => ({
    color: paymentMethodColorMap[method] || "primary",
    count: methods[method].netAmount.toFixed(2),
    label: method,
  }));

  // Step 7: Prepare status badges
  const statusBadges = [
    {
      color: statusMap.Paid.color,
      count: (totals.totalPaid - totals.totalRefunded).toFixed(2),
      label: statusMap.Paid.label,
    },
    {
      color: statusMap.Unpaid.color,
      count: totals.totalPending.toFixed(2),
      label: statusMap.Unpaid.label,
    },
    {
      color: statusMap.Discount.color,
      count: totals.totalDiscount.toFixed(2),
      label: statusMap.Discount.label,
    },
    {
      color: statusMap.Refunded.color,
      count: totals.totalRefunded.toFixed(2),
      label: statusMap.Refunded.label,
    },
  ];

  // Step 8: Construct response
  const response = {
    total: billingData.length,
    badges: [...statusBadges, ...paymentBadges],
    totalBillings: (
      totals.totalBillings -
      totals.totalDiscount -
      totals.totalRefunded -
      totals.totalPending
    ).toFixed(2),
    totalPaid: parseFloat((totals.totalPaid - totals.totalRefunded).toFixed(2)),
    totalDiscount: totals.totalDiscount.toFixed(2),
    totalRefunded: totals.totalRefunded.toFixed(2),
    totalPending: totals.totalPending.toFixed(2),
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
