import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import { DrugItem } from '@evara-backend/core/src/models/pharmacyDashboard/DrugItem';

interface FetchDrugItemsParams {
  clinicId: string;
  drugName?: string;
}

export const fetchDrugItemsForCSV = async (params: FetchDrugItemsParams) => {
  await connectMongoDb();

  const matchCondition: any = {
    clinicId: params.clinicId,
    status: 'Active',
  };

  if (params.drugName) {
    matchCondition.name = { $regex: new RegExp(params.drugName, 'i') };
  }

  const pipeline: any[] = [
    { $match: matchCondition },
    {
      $lookup: {
        from: 'drugcategories',
        localField: 'category',
        foreignField: '_id',
        as: 'drugCategory',
      },
    },
    {
      $lookup: {
        from: 'drugtypes',
        localField: 'type',
        foreignField: '_id',
        as: 'drugType',
      },
    },
    {
      $lookup: {
        from: 'drugmanufacturers',
        localField: 'manufacturer',
        foreignField: '_id',
        as: 'drugManufacturer',
      },
    },
    {
      $lookup: {
        from: 'pharmacystocks',
        localField: '_id',
        foreignField: 'item',
        as: 'pharmacyStock',
      },
    },
    {
      $addFields: {
        drugCategory: {
          $ifNull: [{ $arrayElemAt: ['$drugCategory.name', 0] }, 'N/A'],
        },
        categoryCode: {
          $ifNull: [{ $arrayElemAt: ['$drugCategory._id', 0] }, 'N/A'],
        },
        drugType: { $ifNull: [{ $arrayElemAt: ['$drugType.name', 0] }, 'N/A'] },
        typeCode: { $ifNull: [{ $arrayElemAt: ['$drugType._id', 0] }, 'N/A'] },
        drugCompany: {
          $ifNull: [{ $arrayElemAt: ['$drugManufacturer.name', 0] }, 'N/A'],
        },
        companyCode: {
          $ifNull: [{ $arrayElemAt: ['$drugManufacturer.tin', 0] }, 'N/A'],
        },
        drugName: { $ifNull: ['$name', 'N/A'] },
        genericName: { $ifNull: ['$genericName', 'N/A'] },
        drugCode: { $ifNull: ['$code', 'N/A'] },
        hsnCode: { $ifNull: ['$hsnCode', 'N/A'] },
        qtyPerPack: { $ifNull: ['$packSize', 0] },
        updatedAt: {
          $ifNull: [
            { $arrayElemAt: ['$pharmacyStock.updatedAt', 0] },
            new Date(0),
          ],
        },
      },
    },
    {
      $project: {
        drugCategory: 1,
        categoryCode: 1,
        drugType: 1,
        typeCode: 1,
        drugCompany: 1,
        companyCode: 1,
        drugName: 1,
        genericName: 1,
        drugCode: 1,
        hsnCode: 1,
        qtyPerPack: 1,
        updatedAt: 1,
      },
    },
    { $sort: { updatedAt: -1 } },
  ];

  return await DrugItem.aggregate(pipeline);
};
