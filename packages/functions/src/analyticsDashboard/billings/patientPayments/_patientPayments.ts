import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import { PatientBilling } from '@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling';

interface FetchPatientBillingsDataParams {
  clinicId: string;
  branchId: string;
  page?: number;
  limit?: number;
  status?: string;
  paymentMethod?: string;
  searchQuery?: string;
  startDate?: string;
  endDate?: string;
  billType?: string;
  fetchAllData?: boolean;
}

export const fetchPatientBillingsData = async (
  params: FetchPatientBillingsDataParams,
) => {
  await connectMongoDb();

  const {
    clinicId,
    branchId,
    page = 1,
    limit = 10,
    status,
    paymentMethod,
    searchQuery = '',
    startDate,
    endDate,
    billType,
    fetchAllData = false,
  } = params;

  const pageNumber = Number(page);
  const limitNumber = Number(limit);

  const matchQuery: any = {
    clinicId,
    branchId,
  };

  if (status) matchQuery.status = status;
  if (billType) matchQuery.billType = billType;
  if (paymentMethod) matchQuery['payments.method'] = paymentMethod;

  let pipeline: any[] = [
    { $match: matchQuery },
    {
      $lookup: {
        from: 'patients',
        localField: 'patientCode',
        foreignField: 'patientId',
        as: 'patientDetails',
      },
    },
    {
      $lookup: {
        from: 'cases',
        let: { code: '$patientCode' },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $eq: ['$patientId', '$$code'] },
                  { $eq: ['$partnerId', '$$code'] },
                ],
              },
            },
          },
        ],
        as: 'caseDetails',
      },
    },
    {
      $addFields: {
        patientName: {
          $trim: {
            input: {
              $concat: [
                {
                  $ifNull: [
                    { $arrayElemAt: ['$patientDetails.firstName', 0] },
                    '',
                  ],
                },
                ' ',
                {
                  $ifNull: [
                    { $arrayElemAt: ['$patientDetails.lastName', 0] },
                    '',
                  ],
                },
              ],
            },
          },
        },
        caseId: { $arrayElemAt: ['$caseDetails.caseId', 0] },
      },
    },
  ];

  if (searchQuery) {
    const searchRegex = new RegExp(searchQuery, 'i');
    pipeline.push({
      $match: {
        $or: [
          { billingId: searchRegex },
          { patientName: searchRegex },
          { patientCode: searchRegex },
          { caseId: searchRegex },
        ],
      },
    });
  }

  pipeline.push({ $sort: { createdAt: -1 } });

  // Stage 1: Compute base fields including subTotal
  pipeline.push({
    $addFields: {
      subTotal: {
        $round: [{ $add: ['$amount', { $ifNull: ['$tax', 0] }] }, 2],
      },
      totalPaid: {
        $round: [
          {
            $reduce: {
              input: {
                $filter: {
                  input: '$payments',
                  as: 'payment',
                  cond: { $eq: ['$$payment.type', 'Payment'] },
                },
              },
              initialValue: 0,
              in: { $add: ['$$value', { $ifNull: ['$$this.amount', 0] }] },
            },
          },
          2,
        ],
      },
      totalDues: {
        $round: [
          {
            $subtract: [
              {
                $subtract: [
                  {
                    $round: [
                      { $add: ['$amount', { $ifNull: ['$tax', 0] }] },
                      2,
                    ],
                  },
                  {
                    $reduce: {
                      input: {
                        $filter: {
                          input: '$payments',
                          as: 'payment',
                          cond: { $eq: ['$$payment.type', 'Payment'] },
                        },
                      },
                      initialValue: 0,
                      in: {
                        $add: ['$$value', { $ifNull: ['$$this.amount', 0] }],
                      },
                    },
                  },
                ],
              },
              { $ifNull: ['$discount', 0] },
            ],
          },
          2,
        ],
      },
    },
  });

  // Stage 2: Now safely use subTotal for computed values
  pipeline.push({
    $addFields: {
      taxableValue: {
        $round: [
          {
            $subtract: [
              { $add: ['$subTotal', { $ifNull: ['$discount', 0] }] },
              { $ifNull: ['$tax', 0] },
            ],
          },
          2,
        ],
      },
      totalValue: {
        $round: [{ $add: ['$subTotal', { $ifNull: ['$discount', 0] }] }, 2],
      },
    },
  });

  pipeline.push({
    $addFields: {
      billAmount: {
        $round: [
          {
            $sum: {
              $map: {
                input: '$items',
                as: 'item',
                in: {
                  $let: {
                    vars: {
                      mrp: { $ifNull: ['$$item.mrpPerUnit', 0] },
                      qty: { $ifNull: ['$$item.quantity', 0] },
                      rate: { $ifNull: ['$$item.taxRate', 0] },
                    },
                    in: {
                      $add: [
                        { $multiply: ['$$mrp', '$$qty'] },
                        {
                          $multiply: [
                            { $multiply: ['$$mrp', '$$qty'] },
                            { $divide: ['$$rate', 100] },
                          ],
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
          2,
        ],
      },
    },
  });

  pipeline.push({
    $match: {
      'payments.0': { $exists: true },
    },
  });

  pipeline.push({
    $unwind: {
      path: '$payments',
      preserveNullAndEmptyArrays: true,
    },
  });

  pipeline.push({
    $addFields: {
      effectiveDate: { $ifNull: ['$payments.paymentDate', '$createdAt'] },
    },
  });

  pipeline.push({ $sort: { effectiveDate: -1 } });

  const IST_OFFSET = 5.5 * 60 * 60000;

  if (startDate || endDate) {
    const effectiveDateQuery: any = {};
    if (startDate) {
      effectiveDateQuery.$gte = new Date(
        new Date(startDate).getTime() - IST_OFFSET,
      );
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      effectiveDateQuery.$lte = new Date(endOfDay.getTime() - IST_OFFSET);
    }
    pipeline.push({
      $match: {
        effectiveDate: effectiveDateQuery,
      },
    });
  }

  if (!fetchAllData) {
    pipeline.push({
      $facet: {
        records: [
          { $skip: (pageNumber - 1) * limitNumber },
          { $limit: limitNumber },
          {
            $project: {
              _id: 1,
              billingId: 1,
              clinicId: 1,
              branchId: 1,
              patientCode: 1,
              patientName: 1,
              caseId: 1,
              status: 1,
              billType: 1,
              discount: 1,
              tax: 1,
              amount: 1,
              subTotal: 1,
              totalPaid: 1,
              totalDues: 1,
              taxableValue: 1,
              totalValue: 1,
              billAmount: 1,
              createdAt: 1,
              updatedAt: 1,
              paymentAmount: '$payments.amount',
              paymentMethod: '$payments.method',
              paymentDetails: '$payments.details',
              paymentDate: '$payments.paymentDate',
            },
          },
        ],
        totalCount: [{ $count: 'count' }],
        summaryData: [
          {
            $group: {
              _id: null,
              totalPaymentSum: { $sum: '$payments.amount' },
            },
          },
        ],
      },
    });
  } else {
    pipeline.push({
      $project: {
        _id: 1,
        billingId: 1,
        clinicId: 1,
        branchId: 1,
        patientCode: 1,
        patientName: 1,
        caseId: 1,
        status: 1,
        billType: 1,
        discount: 1,
        tax: 1,
        amount: 1,
        subTotal: 1,
        totalPaid: 1,
        totalDues: 1,
        taxableValue: 1,
        totalValue: 1,
        createdAt: 1,
        updatedAt: 1,
        paymentAmount: '$payments.amount',
        paymentMethod: '$payments.method',
        paymentDetails: '$payments.details',
        paymentDate: '$payments.paymentDate',
      },
    });
  }

  const aggregateResult = await PatientBilling.aggregate(pipeline);

  if (!aggregateResult || !aggregateResult.length) {
    return {
      records: [],
      pagination: {
        totalDocs: 0,
        page: pageNumber,
        limit: limitNumber,
      },
      summary: { paymentSum: 0 },
    };
  }

  if (!fetchAllData) {
    const { records, totalCount, summaryData } = aggregateResult[0] || {
      records: [],
      totalCount: [],
      summaryData: [],
    };

    const totalDocs = totalCount && totalCount.length ? totalCount[0].count : 0;
    let summary = { paymentSum: 0 };
    if (summaryData && summaryData.length > 0) {
      summary = {
        paymentSum: roundToTwo(summaryData[0].totalPaymentSum || 0),
      };
    }

    return {
      records,
      pagination: {
        totalDocs,
        page: pageNumber,
        limit: limitNumber,
      },
      summary,
    };
  } else {
    return {
      records: aggregateResult,
    };
  }
};

/**
 * Helper function to round a number to two decimal places.
 */
function roundToTwo(num: number) {
  return Math.round(num * 100) / 100;
}
