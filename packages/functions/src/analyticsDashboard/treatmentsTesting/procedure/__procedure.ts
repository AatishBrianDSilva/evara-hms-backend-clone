import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import PatientProcedures from '@evara-backend/core/src/models/patientDashboard/procedure/PatientProcedure';
import { getISTDateRangeBounds } from '@evara-backend/core/src/lib/utils/formatDateIST';
import { billingDiscountLookupStages } from '../_billingDiscountJoin';

interface FetchPatientProceduresParams {
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

export const fetchPatientProceduresData = async (
  params: FetchPatientProceduresParams,
) => {
  await connectMongoDb();

  const {
    clinicId,
    branchId,
    page = 1,
    limit = 10,
    status,
    search = '',
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
        patientName: {
          $concat: [
            { $ifNull: ['$patientDetails.firstName', ''] },
            ' ',
            { $ifNull: ['$patientDetails.lastName', ''] },
          ],
        },
        patientId: '$patientDetails.patientId',
      },
    },
    {
      $lookup: {
        from: 'masterprocedures',
        localField: 'procedure',
        foreignField: '_id',
        as: 'procedureDetails',
      },
    },
    {
      $unwind: { path: '$procedureDetails', preserveNullAndEmptyArrays: true },
    },
    {
      $addFields: {
        procedureName: '$procedureDetails.name',
        amount: { $ifNull: ['$procedureDetails.total', 0] },
      },
    },
  ];

  if (search) {
    const searchRegex = new RegExp(search, 'i');
    pipeline.push({
      $match: {
        $or: [
          { patientCode: searchRegex },
          { doctorFullName: searchRegex },
          { patientName: searchRegex },
          { procedureName: searchRegex },
        ],
      },
    });
  }

  pipeline.push(...billingDiscountLookupStages(clinicId));
  pipeline.push({ $sort: { date: -1 } });

  const projectFields = {
    date: 1,
    patientId: 1,
    procedure: '$procedureName',
    doctor: '$doctorFullName',
    amount: 1,
    discount: 1,
    netBilled: 1,
    status: 1,
    patientName: 1,
  };

  if (fetchAllData) {
    pipeline.push({ $project: projectFields });
  } else {
    pipeline.push({
      $facet: {
        records: [
          { $skip: (pageNumber - 1) * limitNumber },
          { $limit: limitNumber },
          { $project: projectFields },
        ],
        totalCount: [{ $count: 'count' }],
      },
    });
  }

  const result = await PatientProcedures.aggregate(pipeline);

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
