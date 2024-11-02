import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import formatPaginationResult from '@evara-backend/core/src/lib/utils/formatPaginationResult';
import { IPaginateOptions } from '@evara-backend/core/src/lib/types/pagination';
import { log } from 'console';
import Doctors from '@evara-backend/core/src/models/mastersDashboard/Doctors';
import { PatientBilling } from '@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling';
import Patient from '@evara-backend/core/models/Patients';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';

interface BillingSummary {
  amount: number;
  payment: number;
  discount: number;
  due: number;
}

const parseSearchQuery = query => {
  const queryParts = query.split(' ');
  const parsedQuery = {
    patientCode: '',
    patientName: '',
  };

  queryParts.forEach(part => {
    if (part.startsWith('patientCode:')) {
      parsedQuery.patientCode = part.split(':')[1];
    } else if (part.startsWith('patientName:')) {
      parsedQuery.patientName = part.split(':')[1];
    }
  });

  return parsedQuery;
};

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;
  const auth = extractAuthorizerDetails(event);

  try {
    await connectMongoDb();

    const params = event.queryStringParameters || {};
    const {
      page = '1',
      limit = '10',
      paginate = 'true', // This will determine if pagination is applied or not
      sort: sortRaw,
      status,
      paymentMethod,
      searchQuery = '',
      saleStartDate,
      saleEndDate,
      billType,
    } = params;

    const isPaginationEnabled = paginate === 'true'; // Check if we are paginating

    const sort = sortRaw ? JSON.parse(sortRaw) : undefined;
    const { patientCode, patientName } = parseSearchQuery(searchQuery);

    const query: any = {
      clinicId: auth.clinicId,
      branchId: auth.branchId,
    };

    if (status) query.status = status;
    if (billType) query.billType = billType; // Apply billType filter

    if (patientCode) {
      query.patientCode = new RegExp(patientCode, 'i');
    }

    if (patientName) {
      const matchingPatients = await Patient.find({
        clinicId: auth.clinicId,
        branchId: auth.branchId,
        $or: [
          { firstName: { $regex: patientName, $options: 'i' } },
          { lastName: { $regex: patientName, $options: 'i' } },
        ],
      }).select('patientId');

      const matchingPatientCodes = matchingPatients.map(p => p.patientId);

      if (matchingPatientCodes.length === 0) {
        query.patientCode = '__NO_MATCH__';
      } else if (patientCode) {
        query.$and = [
          { patientCode: new RegExp(patientCode, 'i') },
          { patientCode: { $in: matchingPatientCodes } },
        ];
      } else {
        query.patientCode = { $in: matchingPatientCodes };
      }
    }

    if (saleStartDate || saleEndDate) {
      const startDate = saleStartDate ? new Date(saleStartDate) : null;
      const endDate = saleEndDate ? new Date(saleEndDate) : null;

      query.$expr = {
        $and: [
          ...(startDate
            ? [
                {
                  $gte: [
                    {
                      $dateFromParts: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' },
                      },
                    },
                    {
                      $dateFromParts: {
                        year: { $year: startDate },
                        month: { $month: startDate },
                        day: { $dayOfMonth: startDate },
                      },
                    },
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
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' },
                      },
                    },
                    {
                      $dateFromParts: {
                        year: { $year: endDate },
                        month: { $month: endDate },
                        day: { $dayOfMonth: endDate },
                      },
                    },
                  ],
                },
              ]
            : []),
        ],
      };
    }

    // Pagination options
    const options: IPaginateOptions = {
      page: isPaginationEnabled ? parseInt(page, 10) : undefined,
      limit: isPaginationEnabled ? parseInt(limit, 10) : undefined,
      sort,
      populate: [
        {
          path: 'items.doctorId',
          model: Doctors.modelName,
        },
      ],
    };

    log('Query', query);

    // Fetch records based on pagination or without pagination
    const result = isPaginationEnabled
      ? await PatientBilling.paginate(query, options)
      : { docs: await PatientBilling.find(query).sort(sort), totalDocs: 0 };

    const { records, pagination } = formatPaginationResult(result);

    const patientIds = Array.from(
      new Set(records.map(record => record.patientCode)),
    );

    const patientData = await Patient.find({
      patientId: { $in: patientIds },
    }).lean();

    const patientMap = patientData.reduce((map, patient) => {
      map[patient.patientId] = patient;
      return map;
    }, {});

    const combinedData = records.flatMap(record => {
      const patientDetails = patientMap[record.patientCode] || {};
      const patientName = `${patientDetails.firstName || ''} ${
        patientDetails.lastName || ''
      }`.trim();

      // Filter payments based on the selected payment method if any
      const filteredPayments = paymentMethod
        ? record.payments.filter(payment => payment.method === paymentMethod)
        : record.payments;

      // Map each filtered payment to a new row with distinct amount and details
      return filteredPayments.map(payment => ({
        _id: `${record._id}-${payment.method}-${payment.amount}`, // Create a unique identifier combining record ID, payment method, and payment amount
        billingId: record.billingId,
        patientCode: record.patientCode,
        patientName,
        createdAt: record.createdAt,
        paymentMethod: payment.method,
        paymentAmount: payment.amount, // Set the specific payment amount for this row
        totalPaid: payment.amount, // Keep the paid amount relevant to this specific payment's amount
        totalDues: record.totalDues, // Use the dues value from the main record
        discount: record.discount, // Keep other relevant fields from the main record
        subTotal: record.subTotal, // Preserve the main record subtotal
        tax: record.tax, // Preserve the tax field
        billType: record.billType, // Added billType field
      }));
    });
    const summary = calculateSummary(records);

    return successResponse('Success', {
      records: combinedData,
      pagination: isPaginationEnabled ? pagination : undefined, // Only include pagination if enabled
      summary: summary,
    });
  } catch (error) {
    return errorResponse(error);
  }
};

function calculateSummary(billings: any[]): BillingSummary {
  const roundToTwo = (num: number) => Math.round(num * 100) / 100;

  return billings.reduce<BillingSummary>(
    (acc, billing) => {
      const total = roundToTwo(billing.subTotal);
      const totalPaid = roundToTwo(
        billing.payments
          .filter(payment => payment.type === 'Payment')
          .reduce((sum, payment) => roundToTwo(sum + payment.amount), 0),
      );

      acc.amount += total;
      acc.payment += totalPaid;
      acc.discount += roundToTwo(billing.discount);
      acc.due += roundToTwo(total - totalPaid - billing.discount);

      return acc;
    },
    { amount: 0, payment: 0, discount: 0, due: 0 },
  );
}
