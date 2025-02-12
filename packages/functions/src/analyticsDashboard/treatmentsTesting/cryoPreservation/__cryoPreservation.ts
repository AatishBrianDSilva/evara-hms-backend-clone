import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import PatientCryoPreservation from '@evara-backend/core/src/models/patientDashboard/cryoPreservation/PatientCryoPreservation';

interface FetchCryoPreservationDataParams {
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

export const fetchCryoPreservationData = async (
  params: FetchCryoPreservationDataParams,
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

  const matchFilter: any = { clinicId, branchId };

  // Apply date range filter
  if (startDate || endDate) {
    matchFilter.date = {
      ...(startDate && { $gte: new Date(startDate) }),
      ...(endDate && { $lte: new Date(endDate) }),
    };
  }

  // Apply status filter
  if (status && status !== 'All') {
    matchFilter.status = status;
  }

  // Build aggregation pipeline
  const pipeline: any[] = [
    { $match: matchFilter },

    // Lookup doctor details
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

    // Lookup patient details
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

    // Lookup cryo preservation details
    {
      $lookup: {
        from: 'mastercryopreservations',
        localField: 'cryo',
        foreignField: '_id',
        as: 'cryoPreservationDetails',
      },
    },
    {
      $unwind: {
        path: '$cryoPreservationDetails',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $addFields: {
        cryoPreservation: '$cryoPreservationDetails.cryoPreservationName',
        amount: { $ifNull: ['$cryoPreservationDetails.total', 0] },
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
          { patientName: searchRegex },
          { doctorFullName: searchRegex },
          { cryoPreservation: searchRegex },
        ],
      },
    });
  }

  // Add sorting and pagination
  pipeline.push({ $sort: { date: -1 } });

  if (!fetchAllData) {
    pipeline.push(
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $project: {
          date: 1,
          patientId: 1,
          patientName: 1,
          cryoPreservation: 1,
          doctor: '$doctorFullName',
          status: 1,
          amount: 1,
        },
      },
    );
  }

  // Execute aggregation
  return await PatientCryoPreservation.aggregate(pipeline);
};
