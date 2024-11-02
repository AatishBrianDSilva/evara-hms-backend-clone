import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { PatientRefund } from '@evara-backend/core/src/models/patientDashboard/Billings/PatientRefund';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import ErrorMessage from '@evara-backend/core/lib/utils/ErrorMessage';
import Patient from '@evara-backend/core/models/Patients';

interface IPaginateOptions {
  page?: number;
  limit?: number;
  sort?: any;
  [key: string]: any;
}

const parseSearchQuery = (query: string) => {
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

  return parsedQuery;
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
      paginate = 'true', // Determines if pagination is applied
      sort: sortRaw,
      searchQuery = '',
    } = params;

    const isPaginationEnabled = paginate === 'true' || paginate === '1';

    const pageNumber = isPaginationEnabled ? parseInt(page, 10) : undefined;
    const pageSize = isPaginationEnabled ? parseInt(limit, 10) : undefined;
    const sortOptions = sortRaw ? JSON.parse(sortRaw) : { createdAt: -1 };

    const { patientCode, patientName } = parseSearchQuery(searchQuery);

    // Build the query condition to filter refunds for the current branch
    const matchCondition: any = {
      branchId: auth.branchId, // Filter refunds by branch
    };

    if (patientCode) {
      matchCondition.patientCode = { $regex: patientCode, $options: 'i' };
    }

    if (patientName) {
      // Find patient IDs that match the patientName
      const matchingPatients = await Patient.find({
        clinicId: auth.clinicId,
        branchId: auth.branchId,
        $or: [
          { firstName: { $regex: patientName, $options: 'i' } },
          { lastName: { $regex: patientName, $options: 'i' } },
        ],
      }).select('patientId');

      const matchingPatientCodes = matchingPatients.map(p => p.patientId);

      if (matchingPatientCodes.length === 0) {
        // No matching patients, so no refunds will match
        matchCondition.patientCode = '__NO_MATCH__'; // Ensures no results
      } else {
        if (matchCondition.patientCode) {
          matchCondition.patientCode = {
            $regex: patientCode,
            $options: 'i',
            $in: matchingPatientCodes,
          };
        } else {
          matchCondition.patientCode = { $in: matchingPatientCodes };
        }
      }
    }

    // Use aggregation to join Patient data and send firstName, lastName, and patientName
    const aggregationPipeline: any[] = [
      {
        $match: matchCondition,
      },
      {
        $lookup: {
          from: 'patients', // Match with the 'Patient' collection
          localField: 'patientCode', // Field in PatientRefund to match
          foreignField: 'patientId', // Field in Patient to match
          as: 'patientDetails', // Output array of matched documents
        },
      },
      {
        $unwind: '$patientDetails', // Unwind the matched patient details
      },
      {
        $project: {
          _id: 1,
          refundDetails: 1,
          patientCode: 1,
          'patientDetails.firstName': 1, // Include firstName
          'patientDetails.lastName': 1, // Include lastName
          patientName: {
            $concat: [
              '$patientDetails.firstName',
              ' ',
              '$patientDetails.lastName',
            ],
          }, // Concatenate firstName and lastName
          createdAt: 1,
        },
      },
      {
        $sort: sortOptions, // Apply dynamic sorting
      },
    ];

    if (isPaginationEnabled) {
      aggregationPipeline.push(
        {
          $skip: (pageNumber - 1) * pageSize,
        },
        {
          $limit: pageSize,
        },
      );
    }

    const refunds = await PatientRefund.aggregate(aggregationPipeline);

    // Count total refunds for pagination
    const totalRefunds = await PatientRefund.countDocuments(matchCondition);

    // Prepare the pagination info
    const pagination = isPaginationEnabled
      ? {
          totalDocs: totalRefunds,
          totalPages: Math.ceil(totalRefunds / pageSize),
          page: pageNumber,
          limit: pageSize,
        }
      : undefined;

    console.log('Refunds retrieved successfully for branch:', auth.branchId);

    // Return the refund data with patient firstName, lastName, and patientName
    return successResponse({
      records: refunds, // Contains refund details with patient firstName, lastName, and patientName
      pagination,
    });
  } catch (error) {
    console.error('Error occurred while fetching refunds:', error);
    return errorResponse(error);
  }
};
