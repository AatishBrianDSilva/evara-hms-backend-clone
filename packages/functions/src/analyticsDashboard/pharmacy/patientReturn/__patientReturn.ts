import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import { PatientRefund } from '@evara-backend/core/models/patientDashboard/Billings/PatientRefund';

interface FetchPatientReturnDataParams {
  clinicId: string;
  branchId: string;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  patientName?: string;
  drugName?: string;
}

export const fetchPatientReturnData = async (
  params: FetchPatientReturnDataParams,
) => {
  await connectMongoDb();

  const {
    clinicId,
    branchId,
    page = 1,
    limit = 25,
    startDate,
    endDate,
    patientName = '',
    drugName = '',
  } = params;

  const skip = (page - 1) * limit;

  const matchCondition: any = { branchId };

  if (startDate || endDate) {
    matchCondition['refundDetails.refundDate'] = {
      ...(startDate && { $gte: new Date(startDate).setUTCHours(0, 0, 0, 0) }),
      ...(endDate && { $lte: new Date(endDate).setUTCHours(23, 59, 59, 999) }),
    };
  }

  if (drugName) {
    matchCondition['refundDetails.items.itemName'] = {
      $regex: new RegExp(drugName, 'i'),
    };
  }

  const pipeline: any[] = [
    { $match: matchCondition },
    { $unwind: '$refundDetails.items' },
    {
      $lookup: {
        from: 'patients',
        localField: 'patientCode', // Ensure this field matches your schema
        foreignField: 'patientId',
        as: 'patientInfo',
      },
    },
    { $unwind: { path: '$patientInfo', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        patientName: {
          $ifNull: [
            {
              $concat: ['$patientInfo.firstName', ' ', '$patientInfo.lastName'],
            },
            'N/A',
          ],
        },
        patientNumber: { $ifNull: ['$patientInfo.mobile', 'N/A'] },
        drugName: '$refundDetails.items.itemName',
        drugCode: '$refundDetails.items._id',
        quantity: '$refundDetails.items.qtyToRefund',
        totalValue: '$refundDetails.items.amountToRefund',
        returnedDate: '$refundDetails.refundDate',
        branch: '$branchId',
      },
    },
    {
      $project: {
        branch: 1,
        returnedDate: 1,
        patientName: 1,
        patientNumber: 1,
        drugName: 1,
        drugCode: 1,
        quantity: 1,
        totalValue: 1,
      },
    },
    ...(patientName
      ? [{ $match: { patientName: { $regex: new RegExp(patientName, 'i') } } }]
      : []),
    { $sort: { returnedDate: -1 } },
    { $skip: skip },
    { $limit: limit },
  ];

  const records = await PatientRefund.aggregate(pipeline);

  const totalDocs = await PatientRefund.countDocuments({
    ...matchCondition,
    'refundDetails.items.batchNo': { $exists: true, $ne: null },
  });

  return { records, totalDocs };
};
