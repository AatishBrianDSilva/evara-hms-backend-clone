import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import PatientInvestigation from '@evara-backend/core/src/models/patientDashboard/investigation/PatientInvestigation';
import { getISTDateRangeBounds } from '@evara-backend/core/src/lib/utils/formatDateIST';
import { billingDiscountLookupStages } from '../_billingDiscountJoin';

interface FetchInvestigationReportsParams {
  clinicId: string;
  branchId: string;
  page?: number;
  limit?: number;
  status?: string;
  searchQuery?: string;
  startDate?: string;
  endDate?: string;
  fetchAllData?: boolean;
}

export const fetchInvestigationReportsData = async (
  params: FetchInvestigationReportsParams,
) => {
  await connectMongoDb();

  const {
    clinicId,
    branchId,
    page = 1,
    limit = 10,
    status,
    searchQuery = '',
    startDate,
    endDate,
    fetchAllData = false,
  } = params;

  const pageNumber = Number(page);
  const limitNumber = Number(limit);

  const matchQuery: any = { clinicId, branchId };

  if (status && status !== 'All') matchQuery.status = status;

  const { start, end } = getISTDateRangeBounds(startDate, endDate);
  if (start || end) {
    matchQuery.date = {
      ...(start && { $gte: start }),
      ...(end && { $lte: end }),
    };
  }

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
        doctorName: {
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
        from: 'masterinvestigations',
        localField: 'investigation',
        foreignField: '_id',
        as: 'investigationDetails',
      },
    },
    {
      $unwind: {
        path: '$investigationDetails',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $addFields: {
        investigationName: '$investigationDetails.name',
        amount: { $ifNull: ['$investigationDetails.total', 0] },
      },
    },
  ];

  if (searchQuery) {
    const searchRegex = new RegExp(searchQuery, 'i');
    pipeline.push({
      $match: {
        $or: [
          { patientCode: searchRegex },
          { doctorName: searchRegex },
          { patientName: searchRegex },
          { investigationName: searchRegex },
        ],
      },
    });
  }

  pipeline.push(...billingDiscountLookupStages(clinicId));
  pipeline.push({ $sort: { date: -1 } });

  if (fetchAllData) {
    pipeline.push({
      $project: {
        date: 1,
        patientId: '$patientCode',
        investigation: '$investigationName',
        doctor: '$doctorName',
        patientName: 1,
        status: 1,
        amount: 1,
        discount: 1,
        netBilled: 1,
        files: '$result.files',
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
              patientId: '$patientCode',
              investigation: '$investigationName',
              doctor: '$doctorName',
              patientName: 1,
              status: 1,
              amount: 1,
              discount: 1,
              netBilled: 1,
              files: '$result.files',
            },
          },
        ],
        totalCount: [{ $count: 'count' }],
      },
    });
  }

  const result = await PatientInvestigation.aggregate(pipeline);

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
