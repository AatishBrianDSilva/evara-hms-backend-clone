import { APIGatewayProxyHandler } from 'aws-lambda';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import { AsyncParser } from '@json2csv/node';
import { fetchRefundsData } from './refundReports';
import { formatToIndianCurrencyFormat } from '@evara-backend/core/lib/utils/formatToIndianCurrencyFormat';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new Error('Unauthorized');
    }

    const params = event.queryStringParameters || {};
    const {
      page = '1',
      limit = '25',
      searchQuery = '',
      allData = 'false',
      sort: sortRaw,
    } = params;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const fetchAllData = allData === 'true';
    const sortOptions = sortRaw ? JSON.parse(sortRaw) : { createdAt: -1 };

    console.log('Fetching Refund Reports with params:', {
      page: fetchAllData ? undefined : pageNumber,
      limit: fetchAllData ? undefined : limitNumber,
      searchQuery,
      allData,
    });

    // Fetch refunds data (disable pagination if allData is true)
    const { records } = await fetchRefundsData({
      clinicId: auth.clinicId,
      branchId: auth.branchId,
      page: fetchAllData ? undefined : pageNumber,
      limit: fetchAllData ? undefined : limitNumber,
      searchQuery,
      sort: sortOptions,
    });

    console.log('Total Records:', records.length);

    let dataForCsv = records;

    if (!fetchAllData) {
      // Add Sl.no only for paginated exports
      const startSlNo = (pageNumber - 1) * limitNumber + 1;
      dataForCsv = records.map((record: any, index: number) => ({
        SlNo: startSlNo + index,
        ...record,
      }));
    } else {
      // Add Sl.no sequentially for all-data exports
      dataForCsv = records.map((record: any, index: number) => ({
        SlNo: index + 1,
        ...record,
      }));
    }

    // Define CSV fields
    const fields = [
      { label: 'Sl.no', value: 'SlNo' },
      {
        label: 'Refund Date',
        value: (row: any) =>
          row.refundDetails?.refundDate
            ? new Date(row.refundDetails.refundDate).toLocaleDateString(
                'en-IN',
                {
                  timeZone: 'Asia/Kolkata',
                },
              )
            : '',
      },

      { label: 'Patient Code', value: 'patientCode' },
      { label: 'Patient Name', value: 'patientName' },
      {
        label: 'Refund Amount',
        value: (row: any) =>
          formatToIndianCurrencyFormat(row.refundDetails?.refundAmount || 0),
      },
      { label: 'Reason for Refund', value: 'refundDetails.reason' },
      { label: 'Payment Method', value: 'refundDetails.method' },
    ];

    // Generate CSV
    const opts = { fields };
    const asyncParser = new AsyncParser(opts);
    const csv = await asyncParser.parse(dataForCsv).promise();
    const csvWithBom = `\uFEFF${csv}`; // UTF-8 BOM for Excel compatibility

    console.log('CSV Generated Successfully');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="refund_reports.csv"`,
        'Access-Control-Allow-Origin': '*', // CORS support
      },
      isBase64Encoded: true,
      body: Buffer.from(csvWithBom).toString('base64'), // Convert to base64
    };
  } catch (error) {
    console.error('Error in Refund Reports CSV API:', error);
    return errorResponse(error);
  }
};
