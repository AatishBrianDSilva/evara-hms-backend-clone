import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import { PatientBilling } from '@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling';

export interface FetchSalesReportParams {
  branchId: string;
  page?: number;
  limit?: number;
  paginate?: boolean;
  saleStartDate?: string;
  saleEndDate?: string;
}

export const fetchSalesReportData = async (params: FetchSalesReportParams) => {
  await connectMongoDb();

  const {
    branchId,
    page = 1,
    limit = 25,
    paginate = true,
    saleStartDate,
    saleEndDate,
  } = params;
  const skip = (page - 1) * limit;

  // --- build filter ---
  const matchCondition: any = { branchId, billType: 'Pharmacy' };
  if (saleStartDate || saleEndDate) {
    const start = saleStartDate ? new Date(saleStartDate) : null;
    const end = saleEndDate ? new Date(saleEndDate) : null;
    matchCondition.createdAt = {
      ...(start && { $gte: new Date(start.setHours(0, 0, 0, 0)) }),
      ...(end && { $lte: new Date(end.setHours(23, 59, 59, 999)) }),
    };
  }

  const pipeline: any[] = [
    { $match: matchCondition },
    { $unwind: '$items' },
    { $match: { 'items.serviceType': 'Pharmacy' } },

    // 1) pharmacyStock via items.masterServiceId
    {
      $lookup: {
        from: 'pharmacystocks',
        localField: 'items.masterServiceId',
        foreignField: '_id',
        as: 'stockData',
      },
    },
    { $unwind: { path: '$stockData', preserveNullAndEmptyArrays: true } },

    // 2) DrugItem via stockData.item
    {
      $lookup: {
        from: 'drugitems',
        localField: 'stockData.item',
        foreignField: '_id',
        as: 'drugData',
      },
    },
    { $unwind: { path: '$drugData', preserveNullAndEmptyArrays: true } },

    // 3) category & type from drugData
    {
      $lookup: {
        from: 'drugcategories',
        localField: 'drugData.category',
        foreignField: '_id',
        as: 'drugCategory',
      },
    },
    { $unwind: { path: '$drugCategory', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'drugtypes',
        localField: 'drugData.type',
        foreignField: '_id',
        as: 'drugType',
      },
    },
    { $unwind: { path: '$drugType', preserveNullAndEmptyArrays: true } },

    // 4) doctor lookup
    {
      $lookup: {
        from: 'doctors',
        localField: 'items.doctorId',
        foreignField: '_id',
        as: 'doctorDetails',
      },
    },
    { $unwind: { path: '$doctorDetails', preserveNullAndEmptyArrays: true } },

    // 5) patient lookup
    {
      $lookup: {
        from: 'patients',
        localField: 'patientCode',
        foreignField: 'patientId',
        as: 'patientDetails',
      },
    },
    { $unwind: { path: '$patientDetails', preserveNullAndEmptyArrays: true } },

    // 6) compute your fields (including category & type!)
    {
      $addFields: {
        saleDate: '$createdAt',
        patientName: {
          $concat: [
            '$patientDetails.firstName',
            ' ',
            '$patientDetails.lastName',
          ],
        },
        doctorName: {
          $concat: [
            'Dr. ',
            '$doctorDetails.firstName',
            ' ',
            '$doctorDetails.lastName',
          ],
        },
        pharmacyDrug: '$drugData.name',
        drugCategory: '$drugCategory.name', // ← now populated
        drugType: '$drugType.name', // ← now populated
        batchNum: '$items.batchNo',
        expiryDate: '$items.expiryDate',
        locationName: '$items.pharmacyDetails.location',
        quantity: '$items.quantity',
        billAmount: '$items.total',
      },
    },

    // 7) project only what you need
    {
      $project: {
        _id: 0,
        saleDate: 1,
        patientName: 1,
        doctorName: 1,
        pharmacyDrug: 1,
        drugCategory: 1,
        drugType: 1,
        batchNum: 1,
        expiryDate: 1,
        locationName: 1,
        quantity: 1,
        billAmount: 1,
      },
    },

    { $sort: { saleDate: -1 } },
  ];

  // apply pagination
  if (paginate) pipeline.push({ $skip: skip }, { $limit: limit });

  const records = await PatientBilling.aggregate(pipeline);

  if (!paginate) {
    return { records };
  }

  const totalDocs = await PatientBilling.countDocuments(matchCondition);
  const totalPages = Math.ceil(totalDocs / limit);
  return { records, pagination: { totalDocs, totalPages, page, limit } };
};
