import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import { InternalConsumption } from '@evara-backend/core/src/models/pharmacyDashboard/InternalConsumption';

interface FetchInternalConsumptionDataParams {
  branchId: string;
  page?: number;
  limit?: number;
  saleStartDate?: string;
  saleEndDate?: string;
  fetchAllData?: boolean;
}

export const fetchInternalConsumptionData = async (
  params: FetchInternalConsumptionDataParams,
) => {
  await connectMongoDb();

  const {
    branchId,
    page = 1,
    limit = 25,
    saleStartDate,
    saleEndDate,
    fetchAllData = false,
  } = params;

  const skip = (page - 1) * limit;

  const matchCondition: any = { branchId };

  if (saleStartDate || saleEndDate) {
    const startDate = saleStartDate ? new Date(saleStartDate) : null;
    const endDate = saleEndDate ? new Date(saleEndDate) : null;

    matchCondition.date = {
      ...(startDate && { $gte: new Date(startDate.setHours(0, 0, 0, 0)) }),
      ...(endDate && { $lte: new Date(endDate.setHours(23, 59, 59, 999)) }),
    };
  }

  const pipeline: any[] = [
    { $match: matchCondition },
    { $unwind: '$items' },
    { $unwind: '$items.batches' },
    {
      $lookup: {
        from: 'pharmacystocks',
        localField: 'items.item',
        foreignField: '_id',
        as: 'pharmacyStock',
      },
    },
    { $unwind: { path: '$pharmacyStock', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'drugitems',
        localField: 'pharmacyStock.item',
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
        as: 'category',
      },
    },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'druglocations',
        localField: 'items.transferFrom.location',
        foreignField: '_id',
        as: 'location',
      },
    },
    { $unwind: { path: '$location', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        centre: { $concat: ['$clinicId', '-', '$branchId'] },
        pharmacyDrugName: '$drugItem.name',
        pharmacyDrugCode: '$drugItem.code',
        locationName: '$location.location',
        locationCode: { $ifNull: ['$location._id', 'N/A'] },
        category: { $ifNull: ['$category.name', 'N/A'] },
        categoryId: { $ifNull: ['$category._id', 'N/A'] },
        quantity: '$items.batches.deductedQuantity',
        unitCost: {
          $ifNull: [
            { $arrayElemAt: ['$pharmacyStock.batches.sellPrice', 0] },
            0,
          ],
        },
        totalCost: {
          $multiply: [
            '$items.batches.deductedQuantity',
            {
              $ifNull: [
                { $arrayElemAt: ['$pharmacyStock.batches.sellPrice', 0] },
                0,
              ],
            },
          ],
        },
        totalTax: {
          $multiply: [
            '$items.batches.deductedQuantity',
            {
              $multiply: [
                {
                  $ifNull: [
                    { $arrayElemAt: ['$pharmacyStock.batches.sellPrice', 0] },
                    0,
                  ],
                },
                0.1, // Assuming 10% tax rate
              ],
            },
          ],
        },
        allocDate: '$date',
        addedBy: '$createdBy',
        remarks: { $ifNull: ['$items.notes', 'N/A'] },
      },
    },
    {
      $project: {
        centre: 1,
        pharmacyDrugName: 1,
        pharmacyDrugCode: 1,
        locationName: 1,
        locationCode: 1,
        category: 1,
        categoryId: 1,
        quantity: 1,
        unitCost: 1,
        totalCost: 1,
        totalTax: 1,
        allocDate: 1,
        addedBy: 1,
        remarks: 1,
      },
    },
    { $sort: { allocDate: -1 } },
  ];

  if (!fetchAllData) {
    pipeline.push({ $skip: skip }, { $limit: limit });
  }

  const records = await InternalConsumption.aggregate(pipeline);

  if (fetchAllData) {
    return { records };
  }

  const totalDocsPipeline = [...pipeline];
  totalDocsPipeline.pop(); // Remove $skip/$limit to accurately count rows
  totalDocsPipeline.push({ $count: 'totalDocs' });
  const countResult = await InternalConsumption.aggregate(totalDocsPipeline);
  const totalDocs = countResult.length ? countResult[0].totalDocs : 0;

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
