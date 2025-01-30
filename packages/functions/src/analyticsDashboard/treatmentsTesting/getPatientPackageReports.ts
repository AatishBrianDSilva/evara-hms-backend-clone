import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import PatientPackage from '@evara-backend/core/src/models/patientDashboard/packages/PatientPackage';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const auth = extractAuthorizerDetails(event);

  try {
    await connectMongoDb();

    const params = event.queryStringParameters || {};
    const {
      startDate,
      endDate,
      page = '1',
      limit = '10',
      search,
      paginate = 'true', // Default to 'true' if not provided
    } = params;

    console.log('params', params);

    const startDateObj = startDate ? new Date(startDate) : null;
    const endDateObj = endDate ? new Date(endDate) : null;

    // Construct the match filter dynamically
    const matchFilter: any = {
      clinicId: auth.clinicId,
      branchId: auth.branchId,
    };

    // Add date range filter if both start and end dates are provided
    if (startDateObj && endDateObj) {
      matchFilter.dateAssigned = {
        $gte: startDateObj,
        $lte: endDateObj,
      };
    }

    // Do not include search conditions here; we will apply them after adding 'doctorFullName'

    // Build the aggregation pipeline
    const pipeline: any[] = [];

    // Initial match stage
    pipeline.push({ $match: matchFilter });

    // Lookup Doctor details
    pipeline.push({
      $lookup: {
        from: 'doctors',
        localField: 'doctor',
        foreignField: '_id',
        as: 'doctor',
      },
    });

    // Unwind the arrays from lookup
    pipeline.push({
      $unwind: { path: '$doctor', preserveNullAndEmptyArrays: true },
    });

    // Add a field for doctor's full name
    pipeline.push({
      $addFields: {
        doctorFullName: {
          $trim: {
            input: {
              $concat: [
                { $ifNull: ['$doctor.firstName', ''] },
                ' ',
                { $ifNull: ['$doctor.lastName', ''] },
              ],
            },
          },
        },
      },
    });

    // Lookup Patient details to get patientName
    pipeline.push({
      $lookup: {
        from: 'patients',
        localField: 'patientCode',
        foreignField: 'patientId',
        as: 'patient',
      },
    });

    // Unwind the patient details
    pipeline.push({
      $unwind: { path: '$patient', preserveNullAndEmptyArrays: true },
    });

    // Add patientName by combining firstName and lastName
    pipeline.push({
      $addFields: {
        patientName: {
          $trim: {
            input: {
              $concat: [
                { $ifNull: ['$patient.firstName', ''] },
                ' ',
                { $ifNull: ['$patient.lastName', ''] },
              ],
            },
          },
        },
      },
    });

    // Apply search filter if search term is provided
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { patientCode: { $regex: search, $options: 'i' } },
            { doctorFullName: { $regex: search, $options: 'i' } },
          ],
        },
      });
    }

    // Lookup treatmentCycle details
    pipeline.push({
      $lookup: {
        from: 'masterpackages',
        localField: 'package',
        foreignField: '_id',
        as: 'package',
      },
    });

    // Unwind the procedure
    pipeline.push({
      $unwind: {
        path: '$package',
        preserveNullAndEmptyArrays: true,
      },
    });

    // Add amount field to ensure calculations are consistent
    pipeline.push({
      $addFields: {
        amount: { $ifNull: ['$package.cost', 0] },
      },
    });

    // Build the facet stage for pagination and total count
    pipeline.push({
      $facet: {
        paginatedResults: [
          // Sort by date descending
          { $sort: { date: -1 } },
          // Apply pagination if enabled
          ...(paginate === 'true'
            ? [
                { $skip: (parseInt(page) - 1) * parseInt(limit) },
                { $limit: parseInt(limit) },
              ]
            : []),
          // Project the required fields
          {
            $project: {
              date: 1,
              patientId: '$patientCode',
              package: '$package.name',
              doctor: '$doctorFullName',
              amount: '$package.cost', // or 'cost' if you prefer
              status: 1,
              patientName: 1,
              files: '$result.files',
            },
          },
        ],
        totalCount: [{ $count: 'count' }],
      },
    });

    // Execute aggregation
    const res = await PatientPackage.aggregate(pipeline);

    // Extract results and total count
    const records = res[0]?.paginatedResults || [];
    const totalDocs = res[0]?.totalCount[0]?.count || 0;
    const totalAmount = records.reduce(
      (sum: any, record: { amount: any }) => sum + (record.amount || 0),
      0,
    );

    // Return the response
    const paginatedResult = {
      records,
      pagination: {
        totalDocs,
        page: parseInt(page),
        limit: parseInt(limit),
      },
      summary: {
        totalAmount,
      },
    };

    return successResponse(
      'Package Reports fetched successfully',
      paginatedResult,
    );
  } catch (error) {
    return errorResponse(error);
  }
};
