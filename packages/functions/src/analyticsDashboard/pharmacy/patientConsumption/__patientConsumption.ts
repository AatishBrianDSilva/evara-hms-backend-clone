import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import { PatientPharmacy } from '@evara-backend/core/src/models/patientDashboard/PatientPharmacy';
import { getISTDateRangeBounds } from '@evara-backend/core/src/lib/utils/formatDateIST';

interface FetchPatientConsumptionParams {
  clinicId: string;
  branchId: string;
  page?: number;
  limit?: number;
  saleStartDate?: string;
  saleEndDate?: string;
  search?: string;
  fetchAllData?: boolean;
}

export const fetchPatientConsumptionData = async (
  params: FetchPatientConsumptionParams,
) => {
  await connectMongoDb();

  const {
    clinicId,
    branchId,
    page = 1,
    limit = 25,
    saleStartDate,
    saleEndDate,
    search = '',
    fetchAllData = false,
  } = params;

  const matchFilter: any = { clinicId, branchId };
  const { start, end } = getISTDateRangeBounds(saleStartDate, saleEndDate);
  if (start || end) {
    matchFilter.date = {
      ...(start && { $gte: start }),
      ...(end && { $lte: end }),
    };
  }

  const pipeline: any[] = [
    { $match: matchFilter },
    { $unwind: '$item.details' },
    {
      $addFields: {
        lineValue: {
          $multiply: [
            {
              $cond: [
                { $gt: ['$item.details.packSize', 0] },
                { $divide: ['$item.details.mrp', '$item.details.packSize'] },
                '$item.details.mrp',
              ],
            },
            '$item.details.quantity',
          ],
        },
      },
    },
    {
      $group: {
        _id: '$patient',
        patientId: { $first: '$patient' },
        totalQuantity: { $sum: '$item.details.quantity' },
        totalValue: { $sum: '$lineValue' },
        allocationCount: { $sum: 1 },
        lastDate: { $max: '$date' },
      },
    },
    {
      $lookup: {
        from: 'patients',
        localField: 'patientId',
        foreignField: 'patientId',
        as: 'patientDetails',
      },
    },
    {
      $unwind: { path: '$patientDetails', preserveNullAndEmptyArrays: true },
    },
    {
      $addFields: {
        patientName: {
          $trim: {
            input: {
              $concat: [
                { $ifNull: ['$patientDetails.firstName', ''] },
                ' ',
                { $ifNull: ['$patientDetails.lastName', ''] },
              ],
            },
          },
        },
      },
    },
  ];

  if (search) {
    const searchRegex = new RegExp(search, 'i');
    pipeline.push({
      $match: {
        $or: [{ patientId: searchRegex }, { patientName: searchRegex }],
      },
    });
  }

  pipeline.push({ $sort: { totalValue: -1 } });

  if (!fetchAllData) {
    pipeline.push({ $skip: (page - 1) * limit }, { $limit: limit });
  }

  pipeline.push({
    $project: {
      _id: 0,
      patientId: 1,
      patientName: 1,
      totalQuantity: 1,
      totalValue: 1,
      allocationCount: 1,
      lastDate: 1,
    },
  });

  return PatientPharmacy.aggregate(pipeline);
};
