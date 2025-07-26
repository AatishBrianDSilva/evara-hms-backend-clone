// packages/functions/src/mastersDashboard/local/patient-list/downloadPatients.ts

import '@evara-backend/core/src/models/Patients';
import '@evara-backend/core/src/models/Cases';

import { APIGatewayProxyHandler } from 'aws-lambda';
import { AsyncParser } from '@json2csv/node';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/src/lib/utils/extractAuthorizerDetails';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import Patient from '@evara-backend/core/src/models/Patients';

export const main: APIGatewayProxyHandler = async (event, _ctx) => {
  _ctx.callbackWaitsForEmptyEventLoop = false;
  try {
    // 1) Auth + DB
    const auth = extractAuthorizerDetails(event);
    if (!auth) throw new ErrorMessage(401, 'Unauthorized');
    await connectMongoDb();

    // 2) Params + mode
    const {
      searchQuery = '',
      startDate,
      endDate,
      branch = 'All',
      page = '1',
      limit = '10',
      allData = 'false',
    } = event.queryStringParameters || {};

    const modeFetchAll = allData === 'true';
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    // 3) Build date filter
    const dateFilter: any = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) {
      const d = new Date(endDate);
      d.setHours(23, 59, 59, 999);
      dateFilter.$lte = d;
    }

    // 4) Branch filter
    const match: any = { clinicId: auth.clinicId };
    if (branch !== 'All') match.branchId = branch;

    // 5) Aggregation pipeline
    const pipeline: any[] = [
      { $match: match },

      // Lookup cases → join array `cases`
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

      // Date filter on createdAt
      ...(startDate || endDate ? [{ $match: { createdAt: dateFilter } }] : []),

      // Text search over id/name/phone/caseId
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

      // Sort newest first
      { $sort: { createdAt: -1 } },

      // Pull out caseId, then drop arrays & unwanted fields
      { $addFields: { caseId: '$cases.caseId' } },
      { $unset: ['cases', 'image', 'identifications'] },

      // Pagination only when not fetching all
      ...(!modeFetchAll
        ? [{ $skip: (pageNum - 1) * limitNum }, { $limit: limitNum }]
        : []),
    ];

    // 6) Run pipeline
    const raw = await Patient.aggregate(pipeline).exec();

    // 7) Format date fields to dd/MM/yyyy in Asia/Kolkata
    const records = raw.map(r => {
      const fmt = (d?: any) =>
        d
          ? new Date(d).toLocaleDateString('en-GB', {
              timeZone: 'Asia/Kolkata',
            })
          : '';
      return {
        ...r,
        dob: fmt(r.dob),
        createdAt: fmt(r.createdAt),
        updatedAt: fmt(r.updatedAt),
      };
    });

    // 8) CSV generation
    if (records.length === 0) {
      const emptyCsv = '\uFEFF';
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="patients.csv"',
          'Access-Control-Allow-Origin': '*',
        },
        isBase64Encoded: true,
        body: Buffer.from(emptyCsv).toString('base64'),
      };
    }

    // Dynamically build columns from keys of the first record
    const fields = Object.keys(records[0]).map(key => ({
      label: key,
      value: key,
    }));

    const parser = new AsyncParser({ fields });
    const csv = await parser.parse(records).promise();
    const csvBom = `\uFEFF${csv}`;
    const body = Buffer.from(csvBom).toString('base64');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="patients.csv"',
        'Access-Control-Allow-Origin': '*',
      },
      isBase64Encoded: true,
      body,
    };
  } catch (err) {
    console.error('Error in downloadPatients:', err);
    return errorResponse(err);
  }
};
