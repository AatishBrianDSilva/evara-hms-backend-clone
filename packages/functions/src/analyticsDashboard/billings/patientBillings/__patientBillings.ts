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

  console.log('params', params);

  // Base match query for clinic and branch
  const matchQuery: any = {
    clinicId,
    branchId,
  };

  // Filter by bill status if provided
  if (status) {
    matchQuery.status = status;
  }

  // Filter by service type if provided
  if (billType) {
    matchQuery.billType = billType;
  }

  // Filter by payment method if provided (exists within 'payments.method')
  if (paymentMethod) {
    matchQuery['payments.method'] = paymentMethod;
  }

  // Filter by date range if startDate and/or endDate are provided
  if (startDate || endDate) {
    const dateQuery: any = {};
    if (startDate) {
      dateQuery.$gte = new Date(startDate);
    }
    if (endDate) {
      // Ensure endDate encompasses the entire day by setting time to 23:59:59.999
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      dateQuery.$lte = endOfDay;
    }
    matchQuery.createdAt = dateQuery;
  }

  // Start constructing the aggregation pipeline
  let pipeline: any[] = [
    { $match: matchQuery },
    // Lookup Patient details
    {
      $lookup: {
        from: 'patients',
        localField: 'patientCode',
        foreignField: 'patientId',
        as: 'patientDetails',
      },
    },
    // Enhanced Lookup Case details to check both 'patientId' and 'partnerId'
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
    // Add fields for patient name and case id
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

  // Apply searchQuery logic if provided for billId, patientName, patientCode, or caseId
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

  // Compute additional fields for all matched documents before pagination
  pipeline = [
    ...pipeline,
    // Sort the documents by createdAt in descending order
    {
      $sort: { createdAt: -1 },
    },
    // Calculate computed fields: subTotal, totalPaid, and totalDues
    {
      $addFields: {
        // subTotal as sum of amount and tax, rounded to two decimals
        subTotal: {
          $round: [
            {
              $add: ['$amount', { $ifNull: ['$tax', 0] }],
            },
            2,
          ],
        },
        // totalPaid as sum of all 'Payment' amounts
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
                in: {
                  $add: ['$$value', { $ifNull: ['$$this.amount', 0] }],
                },
              },
            },
            2,
          ],
        },
        // totalDues as subTotal - totalPaid - discount, rounded to two decimals
        totalDues: {
          $round: [
            {
              $subtract: [
                {
                  $subtract: [
                    {
                      $round: [
                        {
                          $add: ['$amount', { $ifNull: ['$tax', 0] }],
                        },
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
    },
  ];

  // If we're not fetching all data, apply pagination and summary
  if (!fetchAllData) {
    pipeline.push(
      // Finally, set up the facets for pagination and summary
      {
        $facet: {
          // Paginated records
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
                items: 1,
                payments: 1,
                discount: 1,
                tax: 1,
                amount: 1,
                subTotal: 1,
                totalPaid: 1,
                totalDues: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            },
          ],
          // Count total documents matching the query
          totalCount: [{ $count: 'count' }],
          // Summarize all matched documents (not just paginated)
          summaryData: [
            {
              $group: {
                _id: null,
                amountSum: { $sum: '$subTotal' },
                paymentSum: { $sum: '$totalPaid' },
                discountSum: { $sum: '$discount' },
                dueSum: { $sum: '$totalDues' },
              },
            },
          ],
        },
      },
    );
  } else {
    // If fetching all data, project the required fields without pagination
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
        items: 1,
        payments: 1,
        discount: 1,
        tax: 1,
        amount: 1,
        subTotal: 1,
        totalPaid: 1,
        totalDues: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    });
  }

  // Execute the aggregation pipeline
  const aggregateResult = await PatientBilling.aggregate(pipeline);

  // Prepare the results
  if (!aggregateResult || !aggregateResult.length) {
    return {
      records: [],
      pagination: {
        totalDocs: 0,
        page: pageNumber,
        limit: limitNumber,
      },
      summary: { amount: 0, payment: 0, discount: 0, due: 0 },
    };
  }

  if (!fetchAllData) {
    const { records, totalCount, summaryData } = aggregateResult[0] || {
      records: [],
      totalCount: [],
      summaryData: [],
    };

    const totalDocs = totalCount && totalCount.length ? totalCount[0].count : 0;

    // If summaryData is not empty, calculate summary from the group results
    let summary = { amount: 0, payment: 0, discount: 0, due: 0 };
    if (summaryData && summaryData.length > 0) {
      summary = {
        amount: roundToTwo(summaryData[0].amountSum || 0),
        payment: roundToTwo(summaryData[0].paymentSum || 0),
        discount: roundToTwo(summaryData[0].discountSum || 0),
        due: roundToTwo(summaryData[0].dueSum || 0),
      };
    }

    // Format the final paginated result
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
    // If fetching all data, return all records without pagination
    return {
      records: aggregateResult,
    };
  }
};

/**
 * Helper function to round numbers to two decimal places.
 */
function roundToTwo(num: number) {
  return Math.round(num * 100) / 100;
}
