import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import { PharmacyStock } from '@evara-backend/core/src/models/pharmacyDashboard/PharmacyStock';

interface FetchItemStockValuesParams {
  clinicId: string;
  branchId: string;
  page?: number;
  limit?: number;
  search?: string;
  fetchAllData?: boolean;
}

export const fetchItemStockValuesData = async (
  params: FetchItemStockValuesParams,
) => {
  await connectMongoDb();

  const {
    clinicId,
    branchId,
    page = 1,
    limit = 25,
    search = '',
    fetchAllData = false,
  } = params;

  const pipeline: any[] = [
    { $match: { clinicId, branchId } },
    { $unwind: '$batches' },
    { $unwind: '$batches.locations' },
    {
      $lookup: {
        from: 'drugitems',
        localField: 'item',
        foreignField: '_id',
        as: 'itemDetails',
      },
    },
    { $unwind: { path: '$itemDetails', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        unitCost: {
          $cond: [
            { $gt: ['$itemDetails.packSize', 0] },
            { $divide: ['$itemDetails.rate', '$itemDetails.packSize'] },
            0,
          ],
        },
        unitMrp: {
          $cond: [
            { $gt: ['$itemDetails.packSize', 0] },
            { $divide: ['$itemDetails.mrp', '$itemDetails.packSize'] },
            0,
          ],
        },
      },
    },
    {
      $group: {
        _id: '$item',
        drugName: { $first: '$itemDetails.name' },
        drugCode: { $first: '$itemDetails.code' },
        hsnCode: { $first: '$itemDetails.hsnCode' },
        quantity: { $sum: '$batches.locations.quantity' },
        totalCost: {
          $sum: { $multiply: ['$unitCost', '$batches.locations.quantity'] },
        },
        totalMrp: {
          $sum: { $multiply: ['$unitMrp', '$batches.locations.quantity'] },
        },
      },
    },
    {
      $match: {
        $or: [{ totalCost: { $gt: 0 } }, { totalMrp: { $gt: 0 } }],
      },
    },
  ];

  if (search) {
    const searchRegex = new RegExp(search, 'i');
    pipeline.push({
      $match: {
        $or: [{ drugName: searchRegex }, { drugCode: searchRegex }],
      },
    });
  }

  pipeline.push({ $sort: { totalCost: -1 } });

  if (!fetchAllData) {
    pipeline.push({ $skip: (page - 1) * limit }, { $limit: limit });
  }

  pipeline.push({
    $project: {
      _id: 0,
      drugName: { $ifNull: ['$drugName', '—'] },
      drugCode: { $ifNull: ['$drugCode', '—'] },
      hsnCode: { $ifNull: ['$hsnCode', '—'] },
      quantity: 1,
      totalCost: 1,
      totalMrp: 1,
    },
  });

  return PharmacyStock.aggregate(pipeline);
};
