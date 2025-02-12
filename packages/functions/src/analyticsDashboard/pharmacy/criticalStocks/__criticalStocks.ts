import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import { PharmacyStock } from '@evara-backend/core/src/models/pharmacyDashboard/PharmacyStock';

interface FetchCriticalStocksParams {
  branchId: string;
  page?: number;
  limit?: number;
  drugName?: string;
  fetchAllData?: boolean;
}

export const fetchCriticalStocksData = async (
  params: FetchCriticalStocksParams,
) => {
  await connectMongoDb();

  const {
    branchId,
    page = 1,
    limit = 25,
    drugName = '',
    fetchAllData = false,
  } = params;

  const skip = (page - 1) * limit;
  const matchCondition: any = { branchId };

  if (drugName) {
    matchCondition['drugItem.name'] = { $regex: new RegExp(drugName, 'i') };
  }

  const pipeline: any[] = [
    {
      $lookup: {
        from: 'drugitems',
        localField: 'item',
        foreignField: '_id',
        as: 'drugItem',
      },
    },
    { $unwind: { path: '$drugItem', preserveNullAndEmptyArrays: true } },
    { $match: matchCondition },
    {
      $lookup: {
        from: 'drugcategories',
        localField: 'drugItem.category',
        foreignField: '_id',
        as: 'drugCategory',
      },
    },
    { $unwind: { path: '$drugCategory', preserveNullAndEmptyArrays: true } },
    { $unwind: { path: '$batches', preserveNullAndEmptyArrays: true } },
    {
      $unwind: { path: '$batches.locations', preserveNullAndEmptyArrays: true },
    },
    {
      $lookup: {
        from: 'druglocations',
        localField: 'batches.locations.location',
        foreignField: '_id',
        as: 'locationDetails',
      },
    },
    { $unwind: { path: '$locationDetails', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: {
          item: '$item',
          batchId: '$batches._id',
        },
        drugCategory: { $first: '$drugCategory.name' },
        drugName: { $first: '$drugItem.name' },
        drugCode: { $first: '$drugItem.code' },
        totalQty: { $sum: '$batches.locations.quantity' },
        criticalCount: { $first: { $ifNull: ['$drugItem.criticalCount', 10] } },
      },
    },
    {
      $match: { $expr: { $lte: ['$totalQty', '$criticalCount'] } },
    },
    { $sort: { drugName: 1 } },
  ];

  if (!fetchAllData) {
    pipeline.push({
      $facet: {
        records: [{ $skip: skip }, { $limit: limit }],
        totalCount: [{ $count: 'count' }],
      },
    });

    const result = await PharmacyStock.aggregate(pipeline);
    const { records, totalCount } = result[0] || {
      records: [],
      totalCount: [],
    };

    return {
      records,
      pagination: {
        totalDocs: totalCount.length ? totalCount[0].count : 0,
        page,
        limit,
      },
    };
  }

  const records = await PharmacyStock.aggregate(pipeline);
  return { records };
};
