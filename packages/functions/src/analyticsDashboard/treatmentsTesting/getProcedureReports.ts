import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import PatientProcedures from '@evara-backend/core/src/models/patientDashboard/procedure/PatientProcedure';

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
      status,
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
      matchFilter.date = {
        $gte: startDateObj,
        $lte: endDateObj,
      };
    }

    // Add status filter if provided
    if (status && status !== 'All') {
      matchFilter.status = status;
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

    // Lookup procedure details
    pipeline.push({
      $lookup: {
        from: 'masterprocedures',
        localField: 'procedure',
        foreignField: '_id',
        as: 'procedure',
      },
    });

    // Unwind the procedure
    pipeline.push({
      $unwind: {
        path: '$procedure',
        preserveNullAndEmptyArrays: true,
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
              procedure: '$procedure.name',
              doctor: '$doctorFullName',
              amount: '$procedure.total', // or 'cost' if you prefer
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
    const res = await PatientProcedures.aggregate(pipeline);

    // Extract results and total count
    const records = res[0]?.paginatedResults || [];
    const totalDocs = res[0]?.totalCount[0]?.count || 0;

    // Return the response
    const paginatedResult = {
      records,
      pagination: {
        totalDocs,
        page: parseInt(page),
        limit: parseInt(limit),
      },
    };

    return successResponse(
      'Procedures Reports fetched successfully',
      paginatedResult,
    );
  } catch (error) {
    return errorResponse(error);
  }
};
