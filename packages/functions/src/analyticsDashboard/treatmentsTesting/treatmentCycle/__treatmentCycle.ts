import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import PatientTreatmentCycle from '@evara-backend/core/src/models/patientDashboard/treatmentCycle/PatientTreatmentCycle';
import { getISTDateRangeBounds } from '@evara-backend/core/src/lib/utils/formatDateIST';
import { billingDiscountLookupStages } from '../_billingDiscountJoin';

interface FetchTreatmentCyclesParams {
  clinicId: string;
  branchId: string;
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  fetchAllData?: boolean;
}

export const fetchPatientTreatmentCyclesData = async (
  params: FetchTreatmentCyclesParams,
) => {
  await connectMongoDb();

  const {
    clinicId,
    branchId,
    page = 1,
    limit = 10,
    status,
    search,
    startDate,
    endDate,
    fetchAllData = false,
  } = params;

  const pageNumber = Number(page);
  const limitNumber = Number(limit);

  const matchQuery: any = { clinicId, branchId };

  const { start, end } = getISTDateRangeBounds(startDate, endDate);
  if (start || end) {
    matchQuery.date = {
      ...(start && { $gte: start }),
      ...(end && { $lte: end }),
    };
  }

  // Status filter
  if (status && status !== 'All') matchQuery.status = status;

  const pipeline: any[] = [
    { $match: matchQuery },
    {
      $lookup: {
        from: 'doctors',
        localField: 'doctor',
        foreignField: '_id',
        as: 'doctorDetails',
      },
    },
    { $unwind: { path: '$doctorDetails', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        doctorFullName: {
          $concat: [
            { $ifNull: ['$doctorDetails.firstName', ''] },
            ' ',
            { $ifNull: ['$doctorDetails.lastName', ''] },
          ],
        },
      },
    },
    {
      $lookup: {
        from: 'patients',
        localField: 'patient',
        foreignField: '_id',
        as: 'patientDetails',
      },
    },
    { $unwind: { path: '$patientDetails', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        patientId: '$patientDetails.patientId',
        patientName: {
          $concat: [
            { $ifNull: ['$patientDetails.firstName', ''] },
            ' ',
            { $ifNull: ['$patientDetails.lastName', ''] },
          ],
        },
      },
    },
    {
      $lookup: {
        from: 'mastertreatmentcycles',
        localField: 'cycle',
        foreignField: '_id',
        as: 'treatmentCycleDetails',
      },
    },
    {
      $unwind: {
        path: '$treatmentCycleDetails',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $addFields: {
        treatmentCycle: '$treatmentCycleDetails.name',
        amount: { $ifNull: ['$treatmentCycleDetails.total', 0] },
      },
    },
  ];

  // Apply search filter
  if (search) {
    const searchRegex = new RegExp(search, 'i');
    pipeline.push({
      $match: {
        $or: [
          { patientId: searchRegex },
          { doctorFullName: searchRegex },
          { patientName: searchRegex },
          { treatmentCycle: searchRegex },
        ],
      },
    });
  }

  // Add sorting and pagination
  pipeline.push(...billingDiscountLookupStages(clinicId));
  pipeline.push({ $sort: { date: -1 } });

  if (fetchAllData) {
    // PROJECT into exactly the same shape as your paginated facet
    pipeline.push({
      $project: {
        date: 1,
        patientId: 1,
        treatmentCycle: 1,
        doctor: '$doctorFullName',
        amount: 1,
        discount: 1,
        netBilled: 1,
        status: 1,
        patientName: 1,
      },
    });
  } else {
    pipeline.push({
      $facet: {
        records: [
          { $skip: (pageNumber - 1) * limitNumber },
          { $limit: limitNumber },
          {
            $project: {
              date: 1,
              patientId: 1,
              treatmentCycle: 1,
              doctor: '$doctorFullName',
              amount: 1,
              discount: 1,
              netBilled: 1,
              status: 1,
              patientName: 1,
            },
          },
        ],
        totalCount: [{ $count: 'count' }],
      },
    });
  }

  // Execute aggregation
  const result = await PatientTreatmentCycle.aggregate(pipeline);

  if (!fetchAllData) {
    const { records, totalCount } = result[0] || {
      records: [],
      totalCount: [],
    };
    const totalDocs = totalCount.length ? totalCount[0].count : 0;

    return {
      records,
      pagination: {
        totalDocs,
        page: pageNumber,
        limit: limitNumber,
      },
    };
  }

  return { records: result };
};
