// packages/functions/src/mastersDashboard/local/patient-list/getPatientsList.ts

import '@evara-backend/core/src/models/Patients';
import '@evara-backend/core/src/models/Cases';

import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/src/lib/utils/extractAuthorizerDetails';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import Patient from '@evara-backend/core/src/models/Patients';
import Cases from '@evara-backend/core/src/models/Cases';

export const main: APIGatewayProxyHandler = async (event, _ctx) => {
  _ctx.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) throw new ErrorMessage(401, 'Unauthorized');
    await connectMongoDb();

    // 1) parse query params
    const {
      page = '1',
      limit = '10',
      searchQuery = '',
      startDate,
      endDate,
      branch, // optional branch filter: KN, LK, RA, JH, or All
    } = event.queryStringParameters || {};

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const skipNum = (pageNum - 1) * limitNum;

    // 2) build date filter on patient.createdAt
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      const d = new Date(endDate);
      d.setHours(23, 59, 59, 999);
      dateFilter.$lte = d;
    }

    // --------------------------------------------------------------------------------
    // AGGREGATION PIPELINE
    // --------------------------------------------------------------------------------
    //  - 1st $match: Filter Patient by clinicId (and branch, if provided), plus dateRange
    //  - $lookup:    Join Cases where patientId == patient.patientId OR partnerId == patient.patientId
    //  - $unwind:    Flatten to have at most one case per patient
    //  - 2nd $match: If searchQuery, match on patient fields OR joined caseId
    //  - $facet:     Sort (by registration date), skip, limit, project fields & totalCount
    // --------------------------------------------------------------------------------

    // 1) match on clinic (and branch if specified)
    const patientMatch: any = { clinicId: auth.clinicId };
    if (branch && branch !== 'All') {
      patientMatch.branchId = branch;
    }
    if (startDate || endDate) {
      patientMatch.createdAt = dateFilter;
    }

    const pipeline: any[] = [
      // 1) restrict to this clinic (and branch, if any)
      { $match: patientMatch },

      // 2) join in cases
      {
        $lookup: {
          from: 'cases',
          let: { pid: '$patientId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$patientId', '$$pid'] },
                    { $eq: ['$partnerId', '$$pid'] },
                  ],
                },
              },
            },
            { $project: { caseId: 1, _id: 0 } },
          ],
          as: 'cases',
        },
      },
      { $unwind: { path: '$cases', preserveNullAndEmptyArrays: true } },

      // 3) optional text search
      ...(searchQuery
        ? [
            {
              $match: {
                $or: [
                  { patientId: new RegExp(searchQuery, 'i') },
                  { firstName: new RegExp(searchQuery, 'i') },
                  { lastName: new RegExp(searchQuery, 'i') },
                  { mobile: new RegExp(searchQuery, 'i') },
                  { 'cases.caseId': new RegExp(searchQuery, 'i') },
                ],
              },
            },
          ]
        : []),

      // 4) sort by newest registration
      { $sort: { createdAt: -1 } },

      // 5) facet pagination + totalCount
      {
        $facet: {
          paginatedResults: [
            { $skip: skipNum },
            { $limit: limitNum },
            {
              $project: {
                _id: 1,
                patientId: 1,
                caseId: '$cases.caseId',
                branchId: 1,
                firstName: 1,
                lastName: 1,
                gender: 1,
                dob: 1,
                mobile: 1,
                createdAt: 1,
                status: 1,
              },
            },
          ],
          totalCount: [{ $count: 'count' }],
        },
      },
    ];

    // run it on Patient
    const [agg] = await Patient.aggregate(pipeline).exec();
    const records = agg.paginatedResults;
    const totalDocs = agg.totalCount[0]?.count || 0;
    const totalPages = Math.ceil(totalDocs / limitNum);

    return successResponse('Success', {
      records,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalDocs,
        totalPages,
      },
    });
  } catch (err) {
    console.error('Error in getPatientsList:', err);
    return errorResponse(err);
  }
};
