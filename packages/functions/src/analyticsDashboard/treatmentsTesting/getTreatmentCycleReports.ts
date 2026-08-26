import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import PatientTreatmentCycle from '@evara-backend/core/src/models/patientDashboard/treatmentCycle/PatientTreatmentCycle';
import { getISTDateRangeBounds } from '@evara-backend/core/src/lib/utils/formatDateIST';
import { billingDiscountLookupStages } from './_billingDiscountJoin';

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
      paginate = 'true',
    } = params;

    const matchFilter: any = {
      clinicId: auth.clinicId,
      branchId: auth.branchId,
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

    const pipeline: any[] = [
      { $match: matchFilter },
      {
        $lookup: {
          from: 'doctors',
          localField: 'doctor',
          foreignField: '_id',
          as: 'doctor',
        },
      },
      { $unwind: { path: '$doctor', preserveNullAndEmptyArrays: true } },
      {
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
      },
      {
        $lookup: {
          from: 'patients',
          localField: 'patientCode',
          foreignField: 'patientId',
          as: 'patient',
        },
      },
      { $unwind: { path: '$patient', preserveNullAndEmptyArrays: true } },
      {
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
      },
    ];

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { patientCode: { $regex: search, $options: 'i' } },
            { doctorFullName: { $regex: search, $options: 'i' } },
            { patientName: { $regex: search, $options: 'i' } },
          ],
        },
      });
    }

    pipeline.push(
      {
        $lookup: {
          from: 'mastertreatmentcycles',
          localField: 'cycle',
          foreignField: '_id',
          as: 'treatmentCycle',
        },
      },
      {
        $unwind: {
          path: '$treatmentCycle',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          amount: { $ifNull: ['$treatmentCycle.total', 0] },
        },
      },
      ...billingDiscountLookupStages(auth.clinicId),
      {
        $facet: {
          paginatedResults: [
            { $sort: { date: -1 } },
            ...(paginate === 'true'
              ? [
                  { $skip: (parseInt(page) - 1) * parseInt(limit) },
                  { $limit: parseInt(limit) },
                ]
              : []),
            {
              $project: {
                date: 1,
                patientId: '$patientCode',
                treatmentCycle: '$treatmentCycle.name',
                doctor: '$doctorFullName',
                amount: 1,
                discount: 1,
                netBilled: 1,
                status: 1,
                patientName: 1,
                files: 1,
              },
            },
          ],
          totalCount: [{ $count: 'count' }],
        },
      },
    );

    const res = await PatientTreatmentCycle.aggregate(pipeline);
    const records = res[0]?.paginatedResults || [];
    const totalDocs = res[0]?.totalCount[0]?.count || 0;
    const totalAmount = records.reduce(
      (sum: number, record: { amount: number }) => sum + (record.amount || 0),
      0,
    );
    const totalDiscount = records.reduce(
      (sum: number, record: { discount: number | null }) =>
        sum + (record.discount || 0),
      0,
    );
    const totalNetBilled = records.reduce(
      (sum: number, record: { netBilled: number | null }) =>
        sum + (record.netBilled || 0),
      0,
    );

    return successResponse('TreatmentCycle Reports fetched successfully', {
      records,
      pagination: {
        totalDocs,
        page: parseInt(page),
        limit: parseInt(limit),
      },
      summary: {
        totalAmount,
        totalDiscount,
        totalNetBilled,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
};
