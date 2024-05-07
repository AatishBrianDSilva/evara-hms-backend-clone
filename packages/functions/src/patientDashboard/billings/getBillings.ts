import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import formatPaginationResult from "@evara-backend/core/src/lib/utils/formatPaginationResult";
import { IPaginateOptions } from "@evara-backend/core/src/lib/types/pagination";
import { log } from "console";
import Doctors from "@evara-backend/core/src/models/mastersDashboard/Doctors";
import {
  IPatientBilling,
  PatientBilling,
} from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling";

interface BillingSummary {
  amount: number;
  payment: number;
  discount: number;
  due: number;
}

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();

    const params = event.queryStringParameters || {};
    const {
      page = "1",
      limit = "10",
      sort: sortRaw,
      status,
      patientCode,
    } = params;

    const sort = sortRaw ? JSON.parse(sortRaw) : undefined;

    const populate = [
      {
        path: "items.doctorId",
        model: Doctors.modelName,
      },
    ];

    const paginate = JSON.parse(params.paginate || "false");

    const query: any = {};
    query.branchId = "KL";
    query.patientCode = patientCode;
    if (status) {
      query.status = status;
    }

    if (paginate) {
      const options: IPaginateOptions = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      };

      if (sort) {
        options.sort = sort;
      }

      options.populate = populate;

      log("Query", query);

      // Fetching the appointments with pagination
      const result = await PatientBilling.paginate(query, options);

      const { records, pagination } = formatPaginationResult(result);

      const summary = calculateSummary(records);

      return successResponse("Success", {
        records,
        pagination,
        summary: summary,
      });
    } else {
      const data = await PatientBilling.find().populate(populate).sort(sort);

      const records = data.map((doc) => (doc.toJSON ? doc.toJSON() : doc));
      const summary = calculateSummary(data);

      return successResponse("Success", {
        records: records,
        summary: summary,
      });
    }
  } catch (error) {
    return errorResponse(error);
  }
};

function calculateSummary(billings: IPatientBilling[]): BillingSummary {
  return billings.reduce<BillingSummary>(
    (acc, billing) => {
      const total = billing.subTotal;
      const totalPaid = billing.payments
        .filter((payment) => payment.type === "Payment")
        .reduce((sum, payment) => sum + payment.amount, 0);

      acc.amount += total;
      acc.payment += totalPaid;
      acc.discount += billing.discount;
      acc.due += total - totalPaid - billing.discount;

      return acc;
    },
    { amount: 0, payment: 0, discount: 0, due: 0 }
  );
}
