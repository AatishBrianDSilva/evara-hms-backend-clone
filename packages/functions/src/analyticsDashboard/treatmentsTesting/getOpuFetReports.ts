import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import PatientTreatmentCycle from '@evara-backend/core/src/models/patientDashboard/treatmentCycle/PatientTreatmentCycle';
import { getISTDateRangeBounds } from '@evara-backend/core/src/lib/utils/formatDateIST';
import { ETreatmentCycleReport } from '@evara-backend/core/src/models/patientDashboard/treatmentCycle/DefaultTreatmentCycle';

/**
 * Monthly OPU / FET (Embryo Transfer) analytics from treatment-cycle report subdocs.
 * Filters on cycle `date` using IST day bounds.
 *
 * Query: reportType = OPUReport | EmbryoTransferReport
 */
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, 'Unauthorized');
    }

    await connectMongoDb();

    const params = event.queryStringParameters || {};
    const {
      startDate,
      endDate,
      page = '1',
      limit = '25',
      status,
      search,
      reportType = ETreatmentCycleReport.OPUReport,
      paginate = 'true',
    } = params;

    const allowed = [
      ETreatmentCycleReport.OPUReport,
      ETreatmentCycleReport.EmbryoTransferReport,
    ];
    if (!allowed.includes(reportType as ETreatmentCycleReport)) {
      throw new ErrorMessage(
        400,
        `reportType must be one of: ${allowed.join(', ')}`,
      );
    }

    const matchFilter: any = {
      clinicId: auth.clinicId,
      branchId: auth.branchId,
      'reports.reportType': reportType,
    };

    const { start, end } = getISTDateRangeBounds(startDate, endDate);
    if (start || end) {
      matchFilter.date = {
        ...(start && { $gte: start }),
        ...(end && { $lte: end }),
      };
    }

    if (status && status !== 'All') {
      matchFilter.status = status;
    }

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const isPaginated = paginate === 'true';

    const pipeline: any[] = [
      { $match: matchFilter },
      { $unwind: '$reports' },
      { $match: { 'reports.reportType': reportType } },
      {
        $lookup: {
          from: 'doctors',
          localField: 'doctor',
          foreignField: '_id',
          as: 'doctorDetails',
        },
      },
      {
        $unwind: { path: '$doctorDetails', preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: 'patients',
          localField: 'patient',
          foreignField: '_id',
          as: 'patientDetails',
        },
      },
      {
        $unwind: { path: '$patientDetails', preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: 'mastertreatmentcycles',
          localField: 'cycle',
          foreignField: '_id',
          as: 'cycleDetails',
        },
      },
      {
        $unwind: { path: '$cycleDetails', preserveNullAndEmptyArrays: true },
      },
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
          doctorFullName: {
            $trim: {
              input: {
                $concat: [
                  { $ifNull: ['$doctorDetails.firstName', ''] },
                  ' ',
                  { $ifNull: ['$doctorDetails.lastName', ''] },
                ],
              },
            },
          },
          monthKey: {
            $dateToString: {
              format: '%Y-%m',
              date: '$date',
              timezone: 'Asia/Kolkata',
            },
          },
        },
      },
    ];

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      pipeline.push({
        $match: {
          $or: [
            { patientCode: searchRegex },
            { patientName: searchRegex },
            { doctorFullName: searchRegex },
            { 'reports.name': searchRegex },
          ],
        },
      });
    }

    pipeline.push({
      $facet: {
        records: [
          { $sort: { date: -1 } },
          ...(isPaginated
            ? [
                { $skip: (pageNumber - 1) * limitNumber },
                { $limit: limitNumber },
              ]
            : []),
          {
            $project: {
              _id: {
                $concat: [
                  { $toString: '$_id' },
                  '-',
                  { $toString: '$reports._id' },
                ],
              },
              cycleId: '$_id',
              date: 1,
              month: '$monthKey',
              patientId: '$patientCode',
              patientName: 1,
              doctor: '$doctorFullName',
              cycleName: '$cycleDetails.name',
              cycleNo: 1,
              reportName: '$reports.name',
              reportType: '$reports.reportType',
              reportStatus: '$reports.status',
              cycleStatus: '$status',
              files: '$reports.details.files',
            },
          },
        ],
        totalCount: [{ $count: 'count' }],
        byMonth: [
          {
            $group: {
              _id: '$monthKey',
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: -1 } },
          {
            $project: {
              _id: 0,
              month: '$_id',
              count: 1,
            },
          },
        ],
      },
    });

    const res = await PatientTreatmentCycle.aggregate(pipeline);
    const facet = res[0] || { records: [], totalCount: [], byMonth: [] };
    const totalDocs = facet.totalCount[0]?.count || 0;

    return successResponse(`${reportType} reports fetched successfully`, {
      records: facet.records,
      pagination: {
        totalDocs,
        page: pageNumber,
        limit: limitNumber,
      },
      summary: {
        totalCount: totalDocs,
        byMonth: facet.byMonth,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
};
