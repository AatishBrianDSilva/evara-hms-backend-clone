import { APIGatewayProxyHandler } from 'aws-lambda';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import formatPaginationResult from '@evara-backend/core/src/lib/utils/formatPaginationResult';
import TreatmentAdvices from '@evara-backend/core/src/models/patientDashboard/treatmentAdvice/treatmentAdvice';
import { IPaginateOptions } from '@evara-backend/core/src/lib/types/pagination';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  console.log('Invoking treatment advice handler'); // Start log

  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    // Connect to MongoDB
    await connectMongoDb();
    console.log('Connected to MongoDB'); // Log DB connection

    // Extract query string parameters
    const params = event.queryStringParameters || {};
    const {
      page = '1',
      limit = '10',
      paginate,
      sort: sortRaw,
      ...filters
    } = params;

    const sort = sortRaw ? JSON.parse(sortRaw) : { tentativeDate: -1 };

    console.log('Page:', page); // Log pagination parameter
    console.log('Limit:', limit); // Log pagination parameter
    console.log('Paginate:', paginate); // Log pagination parameter

    // Construct the query object
    let query: any = {};

    // Apply additional filters dynamically
    Object.keys(filters).forEach(key => {
      query[key] = filters[key];
    });

    console.log('Query Object:', query); // Debugging log

    // Log all data in the collection
    const allData = await TreatmentAdvices.find().lean();
    console.log('All Treatment Advices Data:', allData);

    // Pagination options
    const options: IPaginateOptions = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      lean: true,
      sort,
    };

    const paginateFlag = JSON.parse(paginate || 'false');
    console.log('Paginate Flag:', paginateFlag); // Log pagination flag

    if (paginateFlag) {
      const result = await TreatmentAdvices.paginate(query, options);
      const { records, pagination } = formatPaginationResult(result);
      console.log('Fetched Records with Pagination:', records); // Debugging log
      return successResponse('Success', { records, pagination });
    } else {
      const records = await TreatmentAdvices.find(query).lean();
      console.log('Fetched Records without Pagination:', records); // Debugging log
      return successResponse('Success', { records, pagination: {} });
    }
  } catch (error) {
    console.error('Error:', error); // Log any errors
    return errorResponse(error);
  }
};
