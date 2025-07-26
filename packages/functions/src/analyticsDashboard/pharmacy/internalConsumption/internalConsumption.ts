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

  // build date filter + branch
  const matchCondition: any = { branchId };
  if (saleStartDate || saleEndDate) {
    const start = saleStartDate ? new Date(saleStartDate) : null;
    const end = saleEndDate ? new Date(saleEndDate) : null;
    matchCondition.date = {
      ...(start && { $gte: new Date(start.setHours(0, 0, 0, 0)) }),
      ...(end && { $lte: new Date(end.setHours(23, 59, 59, 999)) }),
    };
  }

  // aggregation pipeline
  const pipeline: any[] = [
    { $match: matchCondition },
    { $unwind: '$items' },

    // stock lookup
    {
      $lookup: {
        from: 'pharmacystocks',
        localField: 'items.item',
        foreignField: '_id',
        as: 'stock',
      },
    },
    { $unwind: { path: '$stock', preserveNullAndEmptyArrays: true } },

    // drug lookup
    {
      $lookup: {
        from: 'drugitems',
        localField: 'stock.item',
        foreignField: '_id',
        as: 'drug',
      },
    },
    { $unwind: { path: '$drug', preserveNullAndEmptyArrays: true } },

    // taxRate lookup
    {
      $lookup: {
        from: 'taxrates',
        let: { tr: '$drug.taxRate' },
        pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$tr'] } } }],
        as: 'taxRateDetails',
      },
    },
    { $unwind: { path: '$taxRateDetails', preserveNullAndEmptyArrays: true } },

    // category lookup
    {
      $lookup: {
        from: 'drugcategories',
        localField: 'drug.category',
        foreignField: '_id',
        as: 'cat',
      },
    },
    { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },

    // location lookup
    {
      $lookup: {
        from: 'druglocations',
        localField: 'items.transferFrom.location',
        foreignField: '_id',
        as: 'loc',
      },
    },
    { $unwind: { path: '$loc', preserveNullAndEmptyArrays: true } },

    // Stage 1: raw fields
    {
      $addFields: {
        centre: { $concat: ['$clinicId', '-', '$branchId'] },
        pharmacyDrugName: '$drug.name',
        pharmacyDrugCode: '$drug.code',
        category: { $ifNull: ['$cat.name', 'N/A'] },
        categoryCode: { $ifNull: ['$cat._id', 'N/A'] },
        locationName: '$loc.location',
        locationCode: { $ifNull: ['$loc._id', 'N/A'] },

        quantity: '$items.quantity',
        unitPrice: {
          $cond: [
            {
              $and: [
                { $gt: ['$drug.rate', 0] },
                { $gt: ['$drug.packSize', 0] },
              ],
            },
            { $divide: ['$drug.rate', '$drug.packSize'] },
            0,
          ],
        },
        unitMrp: {
          $cond: [
            {
              $and: [{ $gt: ['$drug.mrp', 0] }, { $gt: ['$drug.packSize', 0] }],
            },
            { $divide: ['$drug.mrp', '$drug.packSize'] },
            0,
          ],
        },
        taxRate: { $ifNull: ['$taxRateDetails.taxRate', 0] },
      },
    },

    // Stage 2: cost + sellPrice
    {
      $addFields: {
        cost: { $multiply: ['$unitPrice', '$quantity'] },
        sellPrice: { $multiply: ['$unitMrp', '$quantity'] },
      },
    },

    // Stage 3: totalTax
    {
      $addFields: {
        totalTax: {
          $multiply: ['$cost', { $divide: ['$taxRate', 100] }],
        },
      },
    },

    // filter zero-quantity
    { $match: { quantity: { $gt: 0 } } },

    // project final columns
    {
      $project: {
        _id: 0,
        serialNumber: 1,
        centre: 1,
        pharmacyDrugName: 1,
        pharmacyDrugCode: 1,
        category: 1,
        categoryCode: 1,
        locationName: 1,
        locationCode: 1,
        quantity: 1,
        cost: '$cost',
        sellPrice: '$sellPrice',
        taxRate: 1,
        totalTax: '$totalTax',
        allocDate: '$date',
        addedBy: '$createdBy',
        remarks: { $ifNull: ['$items.notes', 'N/A'] },
      },
    },

    // sort
    { $sort: { allocDate: -1 } },
  ];

  // paginate if not fetching all
  if (!fetchAllData) {
    pipeline.push({ $skip: skip }, { $limit: limit });
  }

  // run aggregation
  const records = await InternalConsumption.aggregate(pipeline);

  // if all data, return raw records
  if (fetchAllData) {
    return { records };
  }

  // otherwise add pagination metadata
  const totalDocs = await InternalConsumption.countDocuments(matchCondition);
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
