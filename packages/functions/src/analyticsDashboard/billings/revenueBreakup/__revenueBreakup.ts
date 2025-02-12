import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import { PatientBilling } from '@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling';

interface FetchRevenueBreakupParams {
  clinicId: string;
  branchId: string;
  page?: number;
  limit?: number;
  createdBy?: string;
  paymentMode?: string;
  startDate?: string;
  endDate?: string;
  fetchAllData?: boolean;
}

export const fetchRevenueBreakupData = async (
  params: FetchRevenueBreakupParams,
) => {
  await connectMongoDb();

  const {
    clinicId,
    branchId,
    page = 1,
    limit = 10,
    createdBy,
    paymentMode,
    startDate,
    endDate,
    fetchAllData = false,
  } = params;

  const pageNumber = Number(page);
  const limitNumber = Number(limit);

  // Construct base match filter
  const matchFilter: any = {
    clinicId,
    branchId,
  };

  if (createdBy) {
    matchFilter.createdBy = createdBy;
  }

  if (paymentMode) {
    matchFilter['payments.method'] = paymentMode;
  }

  if (startDate || endDate) {
    matchFilter.createdAt = {};
    if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
    if (endDate) matchFilter.createdAt.$lte = new Date(endDate);
  }

  const pipeline: any[] = [
    { $match: matchFilter },
    { $unwind: '$payments' },
    {
      $group: {
        _id: {
          createdBy: '$createdBy',
          paymentMethod: '$payments.method',
        },
        totalAmount: { $sum: '$payments.amount' },
      },
    },
    {
      $lookup: {
        from: 'patientrefunds',
        let: {
          createdBy: '$_id.createdBy',
          paymentMethod: '$_id.paymentMethod',
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$createdBy', '$$createdBy'] },
                  { $eq: ['$refundDetails.method', '$$paymentMethod'] },
                  { $gte: ['$refundDetails.refundDate', '$$startDate'] },
                  { $lte: ['$refundDetails.refundDate', '$$endDate'] },
                ],
              },
            },
          },
          { $unwind: '$refundDetails' },
          {
            $group: {
              _id: null,
              totalRefunded: { $sum: '$refundDetails.refundAmount' },
            },
          },
          { $project: { _id: 0, totalRefunded: 1 } },
        ],
        as: 'refundData',
      },
    },
    {
      $addFields: {
        totalRefunded: {
          $ifNull: [{ $arrayElemAt: ['$refundData.totalRefunded', 0] }, 0],
        },
      },
    },
    {
      $project: {
        _id: 0,
        createdBy: '$_id.createdBy',
        paymentMethod: '$_id.paymentMethod',
        totalAmount: 1,
        totalRefunded: 1,
      },
    },
  ];

  if (!fetchAllData) {
    pipeline.push(
      {
        $sort: { totalAmount: -1 },
      },
      {
        $facet: {
          records: [
            { $skip: (pageNumber - 1) * limitNumber },
            { $limit: limitNumber },
          ],
          totalCount: [{ $count: 'count' }],
        },
      },
    );

    const result = await PatientBilling.aggregate(pipeline);
    const { records, totalCount } = result[0] || {
      records: [],
      totalCount: [],
    };
    return {
      records,
      pagination: {
        totalDocs: totalCount.length ? totalCount[0].count : 0,
        page: pageNumber,
        limit: limitNumber,
      },
    };
  }

  const records = await PatientBilling.aggregate(pipeline);
  return { records };
};
