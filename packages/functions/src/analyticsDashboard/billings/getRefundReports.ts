import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { PatientRefund } from '@evara-backend/core/src/models/patientDashboard/Billings/PatientRefund';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import ErrorMessage from '@evara-backend/core/lib/utils/ErrorMessage';
import Patient from '@evara-backend/core/models/Patients';

interface IPaginateOptions {
  clinicId: string;
  branchId: string;
  page: number;
  limit: number;
  searchQuery: string;
  sort?: any;
}

const parseSearchQuery = (query: string) => {
  console.log('Parsing search query:', query); // Log the incoming search query
  const queryParts = query.split(' ');
  const parsedQuery = {
    patientCode: '',
    patientName: '',
  };

  queryParts.forEach(part => {
    if (part.startsWith('patientCode:')) {
      parsedQuery.patientCode = part.split(':')[1];
    } else if (part.startsWith('patientName:')) {
      parsedQuery.patientName = part.split(':')[1];
    }
  });

  console.log('Parsed search query:', parsedQuery); // Log parsed query details
  return parsedQuery;
};

const fetchRefundsData = async ({
  clinicId,
  branchId,
  page,
  limit,
  searchQuery,
  sort = { createdAt: -1 },
}: IPaginateOptions) => {
  console.log('Fetching refunds data with params:', {
    clinicId,
    branchId,
    page,
    limit,
    searchQuery,
    sort,
  });

  // Build match condition
  const matchCondition: any = { branchId };

  // Aggregation pipeline
  const aggregationPipeline: any[] = [
    { $match: matchCondition },
    {
      $lookup: {
        from: 'patients',
        localField: 'patientCode',
        foreignField: 'patientId',
        as: 'patientDetails',
      },
    },
    { $unwind: { path: '$patientDetails', preserveNullAndEmptyArrays: true } },
    // billing lookup for billType → service
    {
      $lookup: {
        from: 'patientbillings',
        localField: 'billingId',
        foreignField: '_id',
        as: 'billingDetails',
      },
    },
    { $unwind: { path: '$billingDetails', preserveNullAndEmptyArrays: true } },

    {
      $addFields: {
        patientName: {
          $trim: {
            input: {
              $concat: [
                { $ifNull: ['$patientDetails.firstName', ''] },
                ' ',
                { $ifNull: ['$patientDetails.lastName', ''] },
              ],
            },
          },
        },
        service: '$billingDetails.billType',
      },
    },
  ];

  // If a search query is provided, apply regex-based filtering across multiple fields
  if (searchQuery) {
    const searchRegex = new RegExp(searchQuery, 'i');
    aggregationPipeline.push({
      $match: {
        $or: [
          { refundId: searchRegex },
          { patientCode: searchRegex },
          { patientName: searchRegex },
        ],
      },
    });
  }

  aggregationPipeline.push(
    { $sort: sort },
    // Add pagination stages only if limit is not -1
    ...(limit !== -1 ? [{ $skip: (page - 1) * limit }, { $limit: limit }] : []),
  );

  console.log(
    'Aggregation pipeline:',
    JSON.stringify(aggregationPipeline, null, 2),
  );

  // Fetch data
  const records = await PatientRefund.aggregate(aggregationPipeline);

  // Total matching refunds
  const totalDocs = await PatientRefund.countDocuments(matchCondition);
  console.log('Total matching refunds:', totalDocs);

  // If limit is -1, return all records without pagination metadata
  return {
    records,
    pagination:
      limit !== -1
        ? {
            totalDocs,
            totalPages: Math.ceil(totalDocs / limit),
            page,
            limit,
          }
        : undefined,
  };
};

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, 'Unauthorized');
    }

    await connectMongoDb();
    console.log('MongoDB connection established for Refund Reports.');

    // Extract query parameters
    const params = event.queryStringParameters || {};
    const {
      page = '1',
      limit = '25',
      searchQuery = '',
      sort: sortRaw,
    } = params;

    // Parse sort options
    const sortOptions = sortRaw ? JSON.parse(sortRaw) : { createdAt: -1 };

    console.log('Query parameters received:', {
      page,
      limit,
      searchQuery,
      sortOptions,
    });

    // Fetch refunds data
    const result = await fetchRefundsData({
      clinicId: auth.clinicId,
      branchId: auth.branchId,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      searchQuery,
      sort: sortOptions,
    });

    return successResponse(result);
  } catch (error) {
    console.error('Error fetching refunds:', error);
    return errorResponse(error);
  }
};
