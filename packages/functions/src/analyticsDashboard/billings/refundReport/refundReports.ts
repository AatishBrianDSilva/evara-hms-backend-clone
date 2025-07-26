import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import { PatientRefund } from '@evara-backend/core/src/models/patientDashboard/Billings/PatientRefund';
import Patient from '@evara-backend/core/src/models/Patients';

interface FetchRefundsDataParams {
  clinicId: string;
  branchId: string;
  page?: number;
  limit?: number;
  searchQuery?: string;
  startDate?: string;
  endDate?: string;
  fetchAllData?: boolean;
  sort?: any; // ✅ Added sort parameter
}

export const fetchRefundsData = async (params: FetchRefundsDataParams) => {
  await connectMongoDb();

  const {
    clinicId,
    branchId,
    page = 1,
    limit = 25,
    searchQuery = '',
    startDate,
    endDate,
    fetchAllData = false,
    sort = { 'refundDetails.refundDate': -1 }, // ✅ Default sorting by refund date (DESC)
  } = params;

  console.log('Fetching Refund Reports with Params:', params);

  const pageNumber = Number(page);
  const limitNumber = Number(limit);

  // Base match query for filtering
  const matchQuery: any = { clinicId, branchId };

  // Search by patientCode or patientName
  if (searchQuery) {
    const searchRegex = new RegExp(searchQuery, 'i');

    // Find patients matching the name
    const matchingPatients = await Patient.find({
      clinicId,
      branchId,
      $or: [{ firstName: searchRegex }, { lastName: searchRegex }],
    }).select('patientId');

    const matchingPatientCodes = matchingPatients.map(p => p.patientId);

    matchQuery.$or = [
      { patientCode: searchRegex }, // Search by patient ID
      { patientCode: { $in: matchingPatientCodes } }, // Search by name
    ];
  }

  // Filter by refund date range
  if (startDate || endDate) {
    matchQuery['refundDetails.refundDate'] = {};
    if (startDate)
      matchQuery['refundDetails.refundDate'].$gte = new Date(startDate);
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      matchQuery['refundDetails.refundDate'].$lte = endOfDay;
    }
  }

  // Aggregation pipeline
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
        from: 'patientbillings',
        localField: 'billingId',
        foreignField: '_id',
        as: 'billingDetails',
      },
    },
    { $unwind: { path: '$billingDetails', preserveNullAndEmptyArrays: true } },

    {
      $addFields: {
        patientName: {
          $concat: [
            {
              $ifNull: [{ $arrayElemAt: ['$patientDetails.firstName', 0] }, ''],
            },
            ' ',
            {
              $ifNull: [{ $arrayElemAt: ['$patientDetails.lastName', 0] }, ''],
            },
          ],
        },
        service: '$billingDetails.billType',
      },
    },
    { $sort: sort }, // ✅ Apply dynamic sorting
  ];

  // Apply pagination only if not fetching all data
  if (!fetchAllData) {
    pipeline.push(
      { $skip: (pageNumber - 1) * limitNumber },
      { $limit: limitNumber },
    );
  }

  // Fetch refund records
  const records = await PatientRefund.aggregate(pipeline);

  // Get total count of matching documents
  const totalDocs = await PatientRefund.countDocuments(matchQuery);

  return {
    records,
    pagination: fetchAllData
      ? undefined
      : {
          totalDocs,
          page: pageNumber,
          limit: limitNumber,
        },
  };
};
