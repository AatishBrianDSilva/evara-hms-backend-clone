import { APIGatewayProxyHandler } from 'aws-lambda';

import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import formatPaginationResult from '@evara-backend/core/src/lib/utils/formatPaginationResult';
import { IPaginateOptions } from '@evara-backend/core/src/lib/types/pagination';
import { DrugVendor } from '@evara-backend/core/src/models/pharmacyDashboard/DrugVendor';
import { DrugItem } from '@evara-backend/core/src/models/pharmacyDashboard/DrugItem';
import Branch from '@evara-backend/core/models/mastersDashboard/global/ClinicBranches';
import { log } from 'console';
import { PurchaseOrder } from '@evara-backend/core/src/models/pharmacyDashboard/PurchaseOrder';
import PatientReports from '@evara-backend/core/src/models/patientDashboard/PatientReports';
import { extractAuthorizerDetails } from '@evara-backend/core/src/lib/utils/extractAuthorizerDetails';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, 'Unauthorized');
    }

    if (event.pathParameters === null) {
      throw new ErrorMessage(400, 'Path parameters are null');
    }

    // Safely access the id property
    const id = event.pathParameters['id'];
    if (!id) {
      throw new ErrorMessage(400, 'Id is not provided');
    }

    await connectMongoDb();

    const params = event.queryStringParameters || {};
    const { page = '1', limit = '10', sort: sortRaw, status } = params;

    const sort = sortRaw ? JSON.parse(sortRaw) : undefined;

    const paginate = JSON.parse(params.paginate || 'false');

    const query: any = {};
    query.branchId = auth.branchId;
    query.clinicId = auth.clinicId;
    query.patient = id;

    if (paginate) {
      const options: IPaginateOptions = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        lean: true,
      };

      if (status) {
        query.status = status;
      }

      if (sort) {
        options.sort = sort;
      }

      log('Query', query);

      // Fetching the appointments with pagination
      const result = await PatientReports.paginate(query, options);
      const { records, pagination } = formatPaginationResult(result);

      return successResponse('Success', {
        records,
        pagination,
      });
    } else {
      const data = await PatientReports.find(query).sort(sort).lean();

      return successResponse('Success', {
        records: data,
      });
    }
  } catch (error) {
    return errorResponse(error);
  }
};
