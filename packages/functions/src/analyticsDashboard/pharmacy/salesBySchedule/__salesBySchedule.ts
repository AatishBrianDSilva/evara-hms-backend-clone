import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import { PatientPharmacy } from '@evara-backend/core/src/models/patientDashboard/PatientPharmacy';

interface FetchSalesReportParams {
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

  const matchCondition: any = { branchId };

  if (saleStartDate || saleEndDate) {
    const startDate = saleStartDate ? new Date(saleStartDate) : null;
    const endDate = saleEndDate ? new Date(saleEndDate) : null;

    matchCondition.$expr = {
      $and: [
        ...(startDate
          ? [
              {
                $gte: [
                  {
                    $dateFromParts: {
                      year: { $year: '$date' },
                      month: { $month: '$date' },
                      day: { $dayOfMonth: '$date' },
                    },
                  },
                  startDate,
                ],
              },
            ]
          : []),
        ...(endDate
          ? [
              {
                $lte: [
                  {
                    $dateFromParts: {
                      year: { $year: '$date' },
                      month: { $month: '$date' },
                      day: { $dayOfMonth: '$date' },
                    },
                  },
                  endDate,
                ],
              },
            ]
          : []),
      ],
    };
  }

  const pipeline: any[] = [
    { $match: matchCondition },
    { $unwind: '$item.details' },
    {
      $lookup: {
        from: 'patients',
        localField: 'patient',
        foreignField: 'patientId',
        as: 'patientDetails',
      },
    },
    { $unwind: { path: '$patientDetails', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'doctors',
        localField: 'doctor',
        foreignField: '_id',
        as: 'doctorDetails',
      },
    },
    { $unwind: { path: '$doctorDetails', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'drugitems',
        localField: 'item.details.itemId',
        foreignField: '_id',
        as: 'drugItemDetails',
      },
    },
    { $unwind: { path: '$drugItemDetails', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'drugcategories', // Lookup for drug category
        localField: 'drugItemDetails.category',
        foreignField: '_id',
        as: 'drugCategoryDetails',
      },
    },
    {
      $unwind: {
        path: '$drugCategoryDetails',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'drugtypes', // Lookup for drug type
        localField: 'drugItemDetails.type',
        foreignField: '_id',
        as: 'drugTypeDetails',
      },
    },
    { $unwind: { path: '$drugTypeDetails', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        saleDate: '$date',
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
        pharmacyDrug: '$drugItemDetails.name',
        drugCategory: { $ifNull: ['$drugCategoryDetails.name', 'N/A'] }, // Fetch category name
        drugType: { $ifNull: ['$drugTypeDetails.name', 'N/A'] }, // Fetch type name
        batchNum: '$item.details.batchNumber',
        expiryDate: '$item.details.expiryDate',
        quantity: '$item.details.quantity',
        billAmount: {
          $multiply: ['$item.details.mrp', '$item.details.quantity'],
        },
      },
    },
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
        quantity: 1,
        billAmount: 1,
      },
    },
    { $sort: { saleDate: -1 } },
  ];

  if (paginate) {
    pipeline.push({ $skip: skip }, { $limit: limit });
  }

  const records = await PatientPharmacy.aggregate(pipeline);

  if (!paginate) {
    return { records };
  }

  const totalDocs = await PatientPharmacy.countDocuments(matchCondition);
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
