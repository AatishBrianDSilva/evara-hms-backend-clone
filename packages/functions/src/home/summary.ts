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

    const dateRange: DateRange = {
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
        totalAmount: { $sum: { $add: ["$amount", "$tax"] } },
        totalPaid: { $sum: "$payments.amount" },
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
        totalBillings: { $sum: "$totalAmount" },
        totalPaid: { $sum: "$totalPaid" },
      },
    },
  ]);

  const dataResult =
    data.length > 0
      ? data[0]
      : { statuses: [], total: 0, totalBillings: 0, totalPaid: 0 };

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
    totalBillings: dataResult.totalBillings,
    totalPaid: dataResult.totalPaid,
  };

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
        status: "Paid",
        createdAt: {
          $gte: dateRange.startDate,
          $lte: dateRange.endDate,
        },
      },
    },
    {
      $unwind: "$items",
    },
    {
      $match: {
        "items.serviceType": "Pharmacy",
      },
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$items.total" },
      },
    },
  ]);

  const response = {
    totalAmount: data.length ? data[0].totalAmount : 0,
  };

  return response;
};
