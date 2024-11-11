import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import MasterPackage from '@evara-backend/core/src/models/patientDashboard/packages/MasterPackage';

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
    };

    // Add date range filter if start and/or end dates are provided
    if (startDateObj && endDateObj) {
      matchFilter.createdAt = {
        $gte: startDateObj,
        $lte: endDateObj,
      };
    } else if (startDateObj) {
      matchFilter.createdAt = { $gte: startDateObj };
    } else if (endDateObj) {
      matchFilter.createdAt = { $lte: endDateObj };
    }

    // Add package name search filter
    if (search) {
      matchFilter.name = { $regex: search, $options: 'i' }; // Case-insensitive search
    }

    const pageInt = parseInt(page, 10) || 1;
    const limitInt = parseInt(limit, 10) || 10;
    const skip = (pageInt - 1) * limitInt;

    const pipeline: any[] = [];

    pipeline.push({ $match: matchFilter });

    // Project only the required fields, transforming arrays into comma-separated strings
    pipeline.push({
      $project: {
        name: 1,
        createdAt: 1,
        gender: 1,
        price: '$cost',
        investigations: {
          $reduce: {
            input: '$investigations',
            initialValue: '',
            in: {
              $concat: [
                {
                  $cond: [
                    { $eq: ['$$value', ''] },
                    '', // If initial value is empty, don't add comma
                    { $concat: ['$$value', ', '] }, // Else, add comma
                  ],
                },
                '$$this.name',
              ],
            },
          },
        },
        procedures: {
          $reduce: {
            input: '$procedures',
            initialValue: '',
            in: {
              $concat: [
                {
                  $cond: [
                    { $eq: ['$$value', ''] },
                    '',
                    { $concat: ['$$value', ', '] },
                  ],
                },
                '$$this.name',
              ],
            },
          },
        },
        cryoPreservations: {
          $reduce: {
            input: '$cryoPreservations',
            initialValue: '',
            in: {
              $concat: [
                {
                  $cond: [
                    { $eq: ['$$value', ''] },
                    '',
                    { $concat: ['$$value', ', '] },
                  ],
                },
                '$$this.name',
              ],
            },
          },
        },
        services: {
          $reduce: {
            input: '$services',
            initialValue: '',
            in: {
              $concat: [
                {
                  $cond: [
                    { $eq: ['$$value', ''] },
                    '',
                    { $concat: ['$$value', ', '] },
                  ],
                },
                '$$this.name',
              ],
            },
          },
        },
        treatments: {
          $reduce: {
            input: '$treatmentCycles',
            initialValue: '',
            in: {
              $concat: [
                {
                  $cond: [
                    { $eq: ['$$value', ''] },
                    '',
                    { $concat: ['$$value', ', '] },
                  ],
                },
                '$$this.name',
              ],
            },
          },
        },
      },
    });

    // Apply pagination if paginate is true
    if (paginate === 'true') {
      pipeline.push({
        $facet: {
          paginatedResults: [{ $skip: skip }, { $limit: limitInt }],
          totalCount: [{ $count: 'count' }],
        },
      });

      const res = await MasterPackage.aggregate(pipeline);

      // Extract results and total count
      const records = res[0]?.paginatedResults || [];
      const totalDocs = res[0]?.totalCount[0]?.count || 0;

      // Return the response
      const paginatedResult = {
        records,
        pagination: {
          totalDocs,
          page: pageInt,
          limit: limitInt,
        },
      };

      return successResponse(
        'Master Packages fetched successfully',
        paginatedResult,
      );
    } else {
      // If pagination is disabled, return all matching records
      const records = await MasterPackage.aggregate(pipeline);
      return successResponse('Master Packages fetched successfully', {
        records,
      });
    }
  } catch (error) {
    return errorResponse(error);
  }
};
