import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import PatientPackage from '@evara-backend/core/src/models/patientDashboard/packages/PatientPackage';

interface FetchPatientPackagesDataParams {
  clinicId: string;
  branchId: string;
  page?: number;
  limit?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
  fetchAllData?: boolean;
}

export const fetchPatientPackagesData = async (
  params: FetchPatientPackagesDataParams,
) => {
  await connectMongoDb();

  const {
    clinicId,
    branchId,
    page = 1,
    limit = 10,
    search = '',
    startDate,
    endDate,
    fetchAllData = false,
  } = params;

  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  const skip = (pageNumber - 1) * limitNumber;

  // Base match query
  const matchQuery: any = {
    clinicId,
    branchId,
  };

  // Apply date range filter
  if (startDate || endDate) {
    const dateQuery: any = {};
    if (startDate) dateQuery.$gte = new Date(startDate);
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      dateQuery.$lte = endOfDay;
    }
    matchQuery.dateAssigned = dateQuery;
  }

  const pipeline: any[] = [
    { $match: matchQuery },
    {
      $lookup: {
        from: 'doctors',
        localField: 'doctor',
        foreignField: '_id',
        as: 'doctor',
      },
    },
    {
      $unwind: { path: '$doctor', preserveNullAndEmptyArrays: true },
    },
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
    {
      $unwind: { path: '$patient', preserveNullAndEmptyArrays: true },
    },
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
    {
      $lookup: {
        from: 'masterpackages',
        localField: 'package',
        foreignField: '_id',
        as: 'package',
      },
    },
    {
      $unwind: { path: '$package', preserveNullAndEmptyArrays: true },
    },
    {
      $addFields: {
        amount: { $ifNull: ['$package.cost', 0] },
      },
    },
    {
      $sort: { dateAssigned: -1 },
    },
    {
      $project: {
        date: '$dateAssigned',
        patientId: '$patientCode',
        package: '$package.name',
        doctor: '$doctorFullName',
        amount: '$package.cost',
        status: 1,
        patientName: 1,
      },
    },
  ];

  // Apply search filter if provided
  if (search) {
    const searchRegex = new RegExp(search, 'i');
    pipeline.push({
      $match: {
        $or: [{ patientCode: searchRegex }, { doctorFullName: searchRegex }],
      },
    });
  }

  // Apply pagination if fetchAllData is false
  if (!fetchAllData) {
    pipeline.push({
      $facet: {
        records: [{ $skip: skip }, { $limit: limitNumber }],
        totalCount: [{ $count: 'count' }],
      },
    });

    const res = await PatientPackage.aggregate(pipeline);
    const { records, totalCount } = res[0] || { records: [], totalCount: [] };
    const totalDocs = totalCount.length ? totalCount[0].count : 0;

    return {
      records,
      pagination: {
        totalDocs,
        page: pageNumber,
        limit: limitNumber,
      },
    };
  } else {
    const records = await PatientPackage.aggregate(pipeline);
    return { records };
  }
};
