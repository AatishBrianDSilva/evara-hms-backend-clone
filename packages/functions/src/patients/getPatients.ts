import { APIGatewayProxyHandler } from 'aws-lambda';

import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import Patient from '@evara-backend/core/models/Patients';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;
  const auth = extractAuthorizerDetails(event);

  try {
    // 1) Connect to MongoDB
    await connectMongoDb();

    // 2) Extract query string parameters
    const params = event.queryStringParameters || {};
    const {
      startDate,
      endDate,
      page = '1',
      limit = '10',
      searchQuery = '',
    } = params;

    // Convert pagination inputs to integers
    const pageNum = parseInt(page.toString(), 10) || 1;
    const limitNum = parseInt(limit.toString(), 10) || 10;
    const skipNum = (pageNum - 1) * limitNum;

    // 3) Build the first $match object for filtering patients
    const matchStage: Record<string, any> = {
      clinicId: auth.clinicId,
      branchId: auth.branchId,
    };

    // Date range filter on Patient.createdAt
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) {
        matchStage.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        matchStage.createdAt.$lte = new Date(endDate);
      }
    }

    /**
     * --------------------------------------------------------------------------------
     * AGGREGATION PIPELINE
     * --------------------------------------------------------------------------------
     * Explanation:
     *  - 1st $match: Filter by clinicId, branchId, date range, etc.
     *  - $lookup:    Join Cases where patientId == patient's patientId OR
     *                partnerId == patient's patientId
     *  - $unwind:    Flatten to have at most one case per patient
     *  - 2nd $match: If searchQuery is provided, match on EITHER patient fields OR caseId
     *  - $facet:     Sort, skip, limit, get total count in one pass
     * --------------------------------------------------------------------------------
     */

    const pipeline: any[] = [
      // 1) First $match
      { $match: matchStage },

      // 2) $lookup for Cases
      {
        $lookup: {
          from: 'cases', // must match the actual MongoDB collection name
          let: { pId: '$patientId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$patientId', '$$pId'] },
                    { $eq: ['$partnerId', '$$pId'] },
                  ],
                },
              },
            },
          ],
          as: 'cases',
        },
      },

      // 3) $unwind to get at most one case per patient
      {
        $unwind: {
          path: '$cases',
          preserveNullAndEmptyArrays: true, // allow patients without a case
        },
      },
    ];

    // 4) If there's a searchQuery, do a second $match that looks for:
    //    - patientId, firstName, lastName, mobile (in the patient)
    //    - OR the caseId in the joined 'cases' doc
    if (searchQuery) {
      pipeline.push({
        $match: {
          $or: [
            { patientId: new RegExp(searchQuery, 'i') },
            { firstName: new RegExp(searchQuery, 'i') },
            { lastName: new RegExp(searchQuery, 'i') },
            { mobile: new RegExp(searchQuery, 'i') },
            // match on the newly joined 'cases.caseId'
            { 'cases.caseId': new RegExp(searchQuery, 'i') },
          ],
        },
      });
    }

    // 5) Now do the $facet to paginate + sort
    pipeline.push({
      $facet: {
        // metadata sub-pipeline: total doc count
        metadata: [{ $count: 'total' }],

        // data sub-pipeline: sort, skip, limit
        data: [
          { $sort: { patientId: 1 } },
          { $skip: skipNum },
          { $limit: limitNum },
          // add a new field for the single caseId
          {
            $addFields: {
              caseId: '$cases.caseId',
            },
          },
          // remove the entire 'cases' field if we only want the single caseId
          {
            $project: {
              cases: 0,
            },
          },
        ],
      },
    });

    // 6) Run the aggregation on Patient
    const [aggregated] = await Patient.aggregate(pipeline).exec();
    const totalRecords = aggregated?.metadata?.[0]?.total || 0;
    const records = aggregated?.data || [];

    // 7) Build pagination object
    const totalPages = Math.ceil(totalRecords / limitNum);
    const pagination = {
      page: pageNum,
      limit: limitNum,
      totalDocs: totalRecords,
      totalPages: totalPages,
    };

    // 8) Return
    return successResponse('Patients fetched successfully', {
      records,
      pagination,
    });
  } catch (error) {
    return errorResponse(error);
  }
};
