import { PharmacyStock } from '@evara-backend/core/src/models/pharmacyDashboard/PharmacyStock';

interface FetchStockDataParams {
  clinicId: string;
  branchId: string;
  search?: string;
  page?: number;
  limit?: number;
  fetchAllData?: boolean;
}

export const fetchStockData = async ({
  clinicId,
  branchId,
  search = '',
  page = 1,
  limit = 25,
  fetchAllData = false,
}: FetchStockDataParams) => {
  const skip = (page - 1) * limit;
  const searchRegex = new RegExp(search, 'i'); // Case-insensitive regex for searching

  // Build the aggregation pipeline
  const aggregationPipeline: any[] = [
    // Match documents based on branchId and clinicId
    { $match: { branchId, clinicId } },

    // Apply search filter if search is provided and not fetching all data
    ...(search
      ? [
          {
            $lookup: {
              from: 'drugitems',
              localField: 'item',
              foreignField: '_id',
              as: 'drugItem',
            },
          },
          { $unwind: '$drugItem' },
          {
            $match: {
              $or: [
                { 'drugItem.name': { $regex: searchRegex } },
                { 'drugItem.code': { $regex: searchRegex } },
              ],
            },
          },
        ]
      : [
          {
            $lookup: {
              from: 'drugitems',
              localField: 'item',
              foreignField: '_id',
              as: 'drugItem',
            },
          },
          { $unwind: '$drugItem' },
        ]),

    // Lookup to get category details from DrugCategory
    {
      $lookup: {
        from: 'drugcategories',
        localField: 'drugItem.category',
        foreignField: '_id',
        as: 'drugCategory',
      },
    },
    {
      $unwind: { path: '$drugCategory', preserveNullAndEmptyArrays: true },
    },

    // Unwind batches (preserveNullAndEmptyArrays to avoid dropping documents without batches)
    { $unwind: { path: '$batches', preserveNullAndEmptyArrays: true } },

    // Unwind batches.locations (preserveNullAndEmptyArrays to avoid dropping documents without locations)
    {
      $unwind: { path: '$batches.locations', preserveNullAndEmptyArrays: true },
    },

    // Lookup to get location details from DrugLocation
    {
      $lookup: {
        from: 'druglocations',
        localField: 'batches.locations.location',
        foreignField: '_id',
        as: 'locationDetails',
      },
    },
    {
      $unwind: { path: '$locationDetails', preserveNullAndEmptyArrays: true },
    },

    // Add fields for locationName and quantity (handling nulls)
    {
      $addFields: {
        locationName: '$locationDetails.location',
        quantity: { $ifNull: ['$batches.locations.quantity', 0] },
      },
    },

    // Group by stock._id to avoid duplicates and sum quantities per location
    {
      $group: {
        _id: '$_id',
        drugCategory: { $first: '$drugCategory.name' },
        drugName: { $first: '$drugItem.name' },
        drugCode: { $first: '$drugItem.code' },
        quantityOnHold: { $first: '$quantityOnHold' },
        // Sum quantities for each location
        Central: {
          $sum: {
            $cond: [
              { $eq: ['$locationName', 'Central Pharmacy'] },
              '$quantity',
              0,
            ],
          },
        },
        OPD: {
          $sum: {
            $cond: [{ $eq: ['$locationName', 'OPD Pharmacy'] }, '$quantity', 0],
          },
        },
        OT: {
          $sum: {
            $cond: [{ $eq: ['$locationName', 'OT Pharmacy'] }, '$quantity', 0],
          },
        },
        Recovery: {
          $sum: {
            $cond: [
              { $eq: ['$locationName', 'Recovery Pharmacy'] },
              '$quantity',
              0,
            ],
          },
        },
        IVF: {
          $sum: {
            $cond: [{ $eq: ['$locationName', 'IVF Pharmacy'] }, '$quantity', 0],
          },
        },
        Returns: {
          $sum: {
            $cond: [
              { $eq: ['$locationName', 'Emergency Pharmacy'] },
              '$quantity',
              0,
            ],
          },
        },
        Internal: {
          $sum: {
            $cond: [
              { $eq: ['$locationName', 'Internal Stock'] },
              '$quantity',
              0,
            ],
          },
        },
      },
    },

    // Add totalQuantity field by summing all location quantities
    {
      $addFields: {
        totalQuantity: {
          $add: [
            '$Central',
            '$OPD',
            '$OT',
            '$Recovery',
            '$IVF',
            '$Returns',
            '$Internal',
          ],
        },
      },
    },

    // Project the required fields
    {
      $project: {
        _id: 1,
        drugCategory: 1,
        drugName: 1,
        drugCode: 1,
        quantityOnHold: 1,
        totalQuantity: 1,
        Central: 1,
        OPD: 1,
        OT: 1,
        Recovery: 1,
        IVF: 1,
        Returns: 1,
        Internal: 1,
      },
    },

    // Sort by drugName (adjust as needed)
    { $sort: { drugName: 1 } },

    // Apply pagination if not fetching all data
    ...(!fetchAllData
      ? [
          {
            $facet: {
              paginatedResults: [{ $skip: skip }, { $limit: limit }],
              totalCount: [{ $count: 'count' }],
            },
          },
        ]
      : []),
  ];

  // Execute the aggregation pipeline
  let result;

  if (fetchAllData) {
    result = await PharmacyStock.aggregate(aggregationPipeline);
    return { records: result };
  } else {
    result = await PharmacyStock.aggregate(aggregationPipeline);
    const records = result[0]?.paginatedResults || [];
    const totalDocs = result[0]?.totalCount[0]?.count || 0;
    return { records, totalDocs };
  }
};
