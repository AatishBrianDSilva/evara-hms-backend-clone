import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import { PharmacyStock } from '@evara-backend/core/src/models/pharmacyDashboard/PharmacyStock';

interface FetchExpiryDetailsDataParams {
  branchId: string;
  page?: number;
  limit?: number;
  drugName?: string;
  startDate?: string;
  endDate?: string;
  fetchAllData?: boolean;
}

export const fetchExpiryDetailsData = async (
  params: FetchExpiryDetailsDataParams,
) => {
  await connectMongoDb();

  const {
    branchId,
    page = 1,
    limit = 25,
    drugName = '',
    startDate,
    endDate,
    fetchAllData = false,
  } = params;

  const skip = (page - 1) * limit;

  const matchCondition: any = { branchId };

  if (drugName) {
    matchCondition['drugItem.name'] = { $regex: new RegExp(drugName, 'i') };
  }

  if (startDate || endDate) {
    const startDateObj = startDate ? new Date(startDate) : null;
    const endDateObj = endDate ? new Date(endDate) : null;

    matchCondition['batches.expiryDate'] = {
      ...(startDateObj && {
        $gte: new Date(startDateObj.setUTCHours(0, 0, 0, 0)),
      }),
      ...(endDateObj && {
        $lte: new Date(endDateObj.setUTCHours(23, 59, 59, 999)),
      }),
    };
  }

  const pipeline: any[] = [
    { $match: matchCondition },
    {
      $lookup: {
        from: 'drugitems',
        localField: 'item',
        foreignField: '_id',
        as: 'drugItem',
      },
    },
    { $unwind: { path: '$drugItem', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'drugcategories',
        localField: 'drugItem.category',
        foreignField: '_id',
        as: 'drugCategory',
      },
    },
    { $unwind: { path: '$drugCategory', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'drugvendors',
        localField: 'batches.vendor',
        foreignField: '_id',
        as: 'vendorDetails',
      },
    },
    { $unwind: { path: '$vendorDetails', preserveNullAndEmptyArrays: true } },
    {
      $unwind: { path: '$batches', preserveNullAndEmptyArrays: true },
    },
    {
      $unwind: { path: '$batches.locations', preserveNullAndEmptyArrays: true },
    },
    {
      $addFields: {
        centre: { $concat: ['$clinicId', ' - ', '$branchId'] },
        invoiceNo: '$_id',
        vendorName: { $ifNull: ['$vendorDetails.name', 'N/A'] },
        drugCategory: { $ifNull: ['$drugCategory.name', 'N/A'] },
        drugName: { $ifNull: ['$drugItem.name', 'N/A'] },
        batchNo: { $ifNull: ['$batches.batchNo', 'N/A'] },
        expiryDate: {
          $cond: {
            if: { $ne: ['$batches.expiryDate', null] },
            then: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$batches.expiryDate',
              },
            },
            else: 'N/A',
          },
        },
        unitCost: '$batches.sellPrice',
        totalQty: { $sum: '$batches.locations.quantity' },
        sumTotalValue: {
          $multiply: ['$batches.sellPrice', '$batches.locations.quantity'],
        },
      },
    },
    {
      $project: {
        centre: 1,
        invoiceNo: 1,
        vendorName: 1,
        drugCategory: 1,
        drugName: 1,
        batchNo: 1,
        expiryDate: 1,
        unitCost: 1,
        totalQty: 1,
        sumTotalValue: 1,
      },
    },
    { $sort: { drugName: 1 } },
  ];

  if (!fetchAllData) {
    pipeline.push({ $skip: skip }, { $limit: limit });
  }

  const records = await PharmacyStock.aggregate(pipeline);

  if (fetchAllData) {
    return { records };
  }

  const totalDocs = await PharmacyStock.countDocuments(matchCondition);
  const totalPages = Math.ceil(totalDocs / limit);

  return {
    records,
    pagination: {
      totalDocs,
      totalPages,
      page,
      limit,
    },
  };
};
