import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import formatPaginationResult from '@evara-backend/core/src/lib/utils/formatPaginationResult';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import ErrorMessage from '@evara-backend/core/lib/utils/ErrorMessage';
import { PatientBilling } from '@evara-backend/core/models/patientDashboard/Billings/PatientBilling';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;
  try {
    // --- Auth & DB ---
    const auth = extractAuthorizerDetails(event);
    if (!auth) throw new ErrorMessage(401, 'Unauthorized');
    await connectMongoDb();

    // --- Params & pagination ---
    const params = event.queryStringParameters || {};
    const {
      page = '1',
      limit = '25',
      paginate = 'true',
      saleStartDate,
      saleEndDate,
    } = params;
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;
    const isPaginationEnabled = paginate === 'true';

    // --- Build match for pharmacy bills ---
    const matchCondition: any = {
      branchId: auth.branchId,
      billType: 'Pharmacy',
    };
    if (saleStartDate || saleEndDate) {
      const start = saleStartDate ? new Date(saleStartDate) : null;
      const end = saleEndDate ? new Date(saleEndDate) : null;
      matchCondition.createdAt = {
        ...(start && { $gte: new Date(start.setHours(0, 0, 0, 0)) }),
        ...(end && { $lte: new Date(end.setHours(23, 59, 59, 999)) }),
      };
    }

    // --- Aggregation pipeline ---
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

      // 2) drugItem via stockData.item
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
      {
        $unwind: { path: '$patientDetails', preserveNullAndEmptyArrays: true },
      },

      // 6) build output fields
      {
        $addFields: {
          saleDate: '$createdAt',
          hospital: '',
          doctorName: {
            $cond: [
              { $and: ['$doctorDetails.firstName', '$doctorDetails.lastName'] },
              {
                $concat: [
                  'Dr. ',
                  '$doctorDetails.firstName',
                  ' ',
                  '$doctorDetails.lastName',
                ],
              },
              'N/A',
            ],
          },
          patientName: {
            $concat: [
              '$patientDetails.firstName',
              ' ',
              '$patientDetails.lastName',
            ],
          },
          pharmacyDrug: '$drugData.name',
          drugCategory: '$drugCategory.name',
          drugType: '$drugType.name',
          batchNum: '$items.batchNo',
          expiryDate: '$items.expiryDate',
          locationName: '$items.pharmacyDetails.location', // or join DrugLocation similarly
          quantity: '$items.quantity',
          billAmount: '$items.total',
        },
      },

      // 7) project final
      {
        $project: {
          _id: 0,
          serialNumber: 1,
          saleDate: 1,
          hospital: 1,
          doctorName: 1,
          patientName: 1,
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

    // --- count total ---
    const countPipeline = [...pipeline];
    if (isPaginationEnabled) countPipeline.push({ $count: 'totalDocs' });
    const countRes = isPaginationEnabled
      ? await PatientBilling.aggregate(countPipeline)
      : [];
    const totalDocs =
      isPaginationEnabled && countRes.length
        ? countRes[0].totalDocs
        : pipeline.length;

    // --- apply pagination ---
    if (isPaginationEnabled) {
      pipeline.push({ $skip: skip }, { $limit: limitNumber });
    }

    // --- execute & serialise ---
    const rows = await PatientBilling.aggregate(pipeline);
    const docs = rows.map((r, i) => ({
      ...r,
      serialNumber: i + 1 + (isPaginationEnabled ? skip : 0),
    }));
    const totalPages = isPaginationEnabled
      ? Math.ceil(totalDocs / limitNumber)
      : 1;

    return successResponse(
      'Sales by Schedule fetched successfully',
      formatPaginationResult({
        docs,
        totalDocs,
        totalPages,
        currentPage: pageNumber,
      }),
    );
  } catch (error) {
    console.error('Error in salesBySchedule API:', error);
    return errorResponse(error);
  }
};
