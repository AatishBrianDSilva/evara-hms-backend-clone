import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import { PatientBilling } from '@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling';

interface FetchHSNReportParams {
  clinicId: string;
  branchId: string;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  fetchAllData?: boolean;
  searchQuery?: string;
}

export const fetchHSNReportData = async (params: FetchHSNReportParams) => {
  await connectMongoDb();

  const {
    clinicId,
    branchId,
    page = 1,
    limit = 10,
    startDate,
    endDate,
    fetchAllData = false,
    searchQuery = '',
  } = params;

  const pageNumber = Number(page);
  const limitNumber = Number(limit);

  const matchQuery: any = {
    clinicId,
    branchId,
    billType: 'Pharmacy',
  };

  if (startDate || endDate) {
    const dateQuery: any = {};
    if (startDate) dateQuery.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateQuery.$lte = end;
    }
    matchQuery.createdAt = dateQuery;
  }

  const basePipeline: any[] = [
    { $match: matchQuery },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'pharmacystocks',
        localField: 'items.masterServiceId',
        foreignField: '_id',
        as: 'stockData',
      },
    },
    { $unwind: { path: '$stockData', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'drugitems',
        localField: 'stockData.item',
        foreignField: '_id',
        as: 'drugData',
      },
    },
    { $unwind: { path: '$drugData', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        drugId: '$drugData._id',
        drugName: '$drugData.name',
        hsnCode: '$drugData.hsnCode',
        quantity: '$items.quantity',
        taxableValue: { $multiply: ['$items.mrpPerUnit', '$items.quantity'] },
        rateOfTax: '$items.taxRate',
        cgst: { $divide: ['$items.tax', 2] },
        sgst: { $divide: ['$items.tax', 2] },
        invoiceValue: '$items.total',
        discount: '$items.discount',
        createdAt: '$createdAt',
      },
    },
    {
      $addFields: {
        netTaxableValue: {
          $round: [
            {
              $subtract: ['$taxableValue', { $ifNull: ['$discount', 0] }],
            },
            2,
          ],
        },
      },
    },
    {
      $group: {
        _id: {
          drugId: '$drugId',
          drugName: '$drugName',
          taxRate: '$rateOfTax',
        },
        hsnCode: { $first: '$hsnCode' },
        quantity: { $sum: '$quantity' },
        taxableValue: { $sum: '$taxableValue' },
        netTaxableValue: { $sum: '$netTaxableValue' },
        invoiceValue: { $sum: '$invoiceValue' },
        cgst: { $sum: '$cgst' },
        sgst: { $sum: '$sgst' },
        rateOfTax: { $first: '$rateOfTax' },
        createdAt: { $max: '$createdAt' },
      },
    },
    {
      $project: {
        _id: 0,
        drugId: '$_id.drugId',
        drugName: '$_id.drugName',
        hsnCode: 1,
        quantity: 1,
        rateOfTax: 1,
        taxableValue: { $round: ['$taxableValue', 2] },
        netTaxableValue: { $round: ['$netTaxableValue', 2] },
        invoiceValue: { $round: ['$invoiceValue', 2] },
        cgst: { $round: ['$cgst', 2] },
        sgst: { $round: ['$sgst', 2] },
        createdAt: 1,
      },
    },
    { $sort: { createdAt: -1 } },
  ];

  if (searchQuery) {
    basePipeline.push({
      $match: {
        $or: [
          { drugName: { $regex: searchQuery, $options: 'i' } },
          { hsnCode: { $regex: searchQuery, $options: 'i' } },
        ],
      },
    });
  }

  if (!fetchAllData) {
    const paginatedPipeline = [
      ...basePipeline,
      {
        $facet: {
          records: [
            { $skip: (pageNumber - 1) * limitNumber },
            { $limit: limitNumber },
          ],
          totalCount: [{ $count: 'count' }],
        },
      },
    ];

    //aggregate funciton
    const result = await PatientBilling.aggregate(paginatedPipeline);
    const records = result[0]?.records || [];
    const totalDocs = result[0]?.totalCount?.[0]?.count || 0;

    return {
      records,
      pagination: {
        totalDocs,
        page: pageNumber,
        limit: limitNumber,
      },
    };
  } else {
    const result = await PatientBilling.aggregate(basePipeline);
    return { records: result };
  }
};
