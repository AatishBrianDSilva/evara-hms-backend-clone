import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import formatPaginationResult from '@evara-backend/core/src/lib/utils/formatPaginationResult';
import { IPaginateOptions } from '@evara-backend/core/src/lib/types/pagination';
import { log } from 'console';
import Doctors from '@evara-backend/core/src/models/mastersDashboard/Doctors';
import {
  IPatientBilling,
  PatientBilling,
} from '@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';

interface BillingSummary {
  amount: number;
  payment: number;
  discount: number;
  due: number;
}

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    await connectMongoDb();

    const params = event.queryStringParameters || {};
    const { page = '1', limit = '10', sort: sortRaw, status } = params;

    const sort = sortRaw ? JSON.parse(sortRaw) : undefined;

    const query: any = {};
    query.clinicId = auth.clinicId;
    query.branchId = auth?.branchId; // Example, this could be dynamic or omitted
    if (status) {
      query.status = status;
    }

    // Add patient code (patient ID) filter to the query
    if (params.patientCode) {
      query.patientCode = params.patientCode; // Case-insensitive match for Patient ID
    }

    const options: IPaginateOptions = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort,
      populate: [
        {
          path: 'items.doctorId',
          model: Doctors.modelName,
        },
      ],
    };

    log('Query', query);

    //Get Summary data
    const summaryData = await PatientBilling.find(query);

    // Fetching the billings with pagination
    const result = await PatientBilling.paginate(query, options);
    const { records, pagination } = formatPaginationResult(result);

    const summary = calculateSummary(summaryData);

    return successResponse('Success', {
      records: records,
      pagination: pagination,
      summary: summary,
    });
  } catch (error) {
    return errorResponse(error);
  }
};

function calculateSummary(billings: IPatientBilling[]): BillingSummary {
  return billings.reduce<BillingSummary>(
    (acc, billing) => {
      // Calculate MRP-based bill amount including tax
      const itemTotal = billing.items.reduce((sum, item) => {
        const mrp = Number(item?.mrpPerUnit || 0);
        const qty = Number(item?.quantity || 0);
        const taxRate = Number(item?.taxRate || 0); // percentage

        const base = mrp * qty;
        const tax = (base * taxRate) / 100;

        return sum + base + tax;
      }, 0);

      // Payments of type 'Payment'
      const totalPaid = billing.payments
        .filter(payment => payment.type === 'Payment')
        .reduce((sum, payment) => sum + payment.amount, 0);

      // Dues (you already have a virtual `totalDues`)
      const totalDue = billing.totalDues ?? 0;

      acc.amount += itemTotal;
      acc.payment += totalPaid;
      acc.discount += billing.discount ?? 0;
      acc.due += totalDue;

      return acc;
    },
    { amount: 0, payment: 0, discount: 0, due: 0 },
  );
}
