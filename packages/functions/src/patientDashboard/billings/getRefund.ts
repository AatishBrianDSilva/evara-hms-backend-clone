import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { PatientRefund } from '@evara-backend/core/src/models/patientDashboard/Billings/PatientRefund';
import { extractAuthorizerDetails } from '@evara-backend/core/src/lib/utils/extractAuthorizerDetails';
import { IPaginateOptions } from '@evara-backend/core/src/lib/types/pagination';
import formatPaginationResult from '@evara-backend/core/src/lib/utils/formatPaginationResult';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import { PatientBilling } from '@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    await connectMongoDb();

    const params = event.queryStringParameters || {};
    const { page = '1', limit = '10', sort: sortRaw } = params;

    if (!params.patientCode) {
      throw new ErrorMessage(400, 'Patient Code is required');
    }

    const sort = sortRaw ? JSON.parse(sortRaw) : undefined;

    const query: any = {};
    query.clinicId = auth.clinicId;
    query.branchId = auth?.branchId;

    // Add patient code (patient ID) filter to the query
    query.patientCode = params.patientCode; // Case-insensitive match for Patient ID

    const options: IPaginateOptions = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort,
      populate: [
        {
          path: 'billingId',
          model: PatientBilling.modelName,
        },
      ],
    };

    const summaryData = await PatientRefund.find(query).lean();
    const totalRefunded = summaryData.reduce(
      (total, refund) => total + refund.refundDetails.refundAmount,
      0,
    );

    // Fetching the billings with pagination
    const result = await PatientRefund.paginate(query, options);
    const { records, pagination } = formatPaginationResult(result);

    return successResponse('Success', {
      records: records,
      pagination: pagination,
      summary: {
        totalRefunded: totalRefunded,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
};
