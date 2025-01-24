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

  const { patientCode, patientName } = parseSearchQuery(searchQuery);

  // Build match condition
  const matchCondition: any = { branchId };
  if (patientCode) {
    matchCondition.patientCode = { $regex: patientCode, $options: 'i' };
  }
  if (patientName) {
    const matchingPatients = await Patient.find({
      clinicId,
      branchId,
      $or: [
        { firstName: { $regex: patientName, $options: 'i' } },
        { lastName: { $regex: patientName, $options: 'i' } },
      ],
    }).select('patientId');

    const matchingPatientCodes = matchingPatients.map(p => p.patientId);

    matchCondition.patientCode = matchingPatientCodes.length
      ? { $in: matchingPatientCodes }
      : '__NO_MATCH__';
  }

  console.log('Match condition for refunds:', matchCondition);

  // Total matching refunds
  const totalDocs = await PatientRefund.countDocuments(matchCondition);
  console.log('Total matching refunds:', totalDocs);

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
    { $unwind: '$patientDetails' },
    {
      $project: {
        _id: 1,
        refundDetails: 1,
        patientCode: 1,
        'patientDetails.firstName': 1,
        'patientDetails.lastName': 1,
        patientName: {
          $concat: [
            '$patientDetails.firstName',
            ' ',
            '$patientDetails.lastName',
          ],
        },
        createdAt: 1,
      },
    },
    { $sort: sort },
  ];

  // Add pagination stages only if limit is not -1
  if (limit !== -1) {
    const skip = (page - 1) * limit;
    console.log('Skip value:', skip);

    aggregationPipeline.push({ $skip: skip }, { $limit: limit });
  } else {
    console.log('Returning all records without pagination');
  }

  console.log(
    'Aggregation pipeline:',
    JSON.stringify(aggregationPipeline, null, 2),
  );

  // Fetch data
  const records = await PatientRefund.aggregate(aggregationPipeline);

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
