import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import PatientProcedures from '@evara-backend/core/src/models/patientDashboard/procedure/PatientProcedure';
import { getISTDateRangeBounds } from '@evara-backend/core/src/lib/utils/formatDateIST';

/**
 * Procedure-wise monthly statistics.
 * Groups completed/filtered procedures by procedure name × IST calendar month.
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
    const { startDate, endDate, status, search } = params;

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
          from: 'masterprocedures',
          localField: 'procedure',
          foreignField: '_id',
          as: 'procedureDetails',
        },
      },
      {
        $unwind: {
          path: '$procedureDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          procedureName: {
            $ifNull: ['$procedureDetails.name', 'Unknown'],
          },
          amount: { $ifNull: ['$procedureDetails.total', 0] },
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
      pipeline.push({
        $match: {
          procedureName: { $regex: search, $options: 'i' },
        },
      });
    }

    pipeline.push(
      {
        $group: {
          _id: {
            month: '$monthKey',
            procedure: '$procedureName',
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
      {
        $project: {
          _id: 0,
          id: {
            $concat: ['$_id.month', '|', '$_id.procedure'],
          },
          month: '$_id.month',
          procedure: '$_id.procedure',
          count: 1,
          totalAmount: 1,
        },
      },
      { $sort: { month: -1, procedure: 1 } },
    );

    const records = await PatientProcedures.aggregate(pipeline);

    const summary = records.reduce(
      (acc: { totalCount: number; totalAmount: number }, row: any) => {
        acc.totalCount += row.count || 0;
        acc.totalAmount += row.totalAmount || 0;
        return acc;
      },
      { totalCount: 0, totalAmount: 0 },
    );

    return successResponse(
      'Procedure monthly statistics fetched successfully',
      {
        records,
        summary,
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
};
