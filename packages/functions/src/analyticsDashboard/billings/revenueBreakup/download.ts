import { APIGatewayProxyHandler } from 'aws-lambda';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import { AsyncParser } from '@json2csv/node';
import { fetchRevenueBreakupData } from './__revenueBreakup';
import { formatToIndianCurrencyFormat } from '@evara-backend/core/lib/utils/formatToIndianCurrencyFormat';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    const params = event.queryStringParameters || {};
    const {
      page = '1',
      limit = '10',
      createdBy,
      paymentMode,
      startDate,
      endDate,
      allData = 'false',
    } = params;

    const fetchAllData = allData === 'true';

    const { records } = await fetchRevenueBreakupData({
      clinicId: auth.clinicId,
      branchId: auth.branchId,
      page: fetchAllData ? undefined : parseInt(page, 10),
      limit: fetchAllData ? undefined : parseInt(limit, 10),
      createdBy,
      paymentMode,
      startDate,
      endDate,
      fetchAllData,
    });

    let dataForCsv = records.map((record: any, index: number) => ({
      SlNo: index + 1,
      createdBy: record.createdBy,
      paymentMethod: record.paymentMethod,
      totalAmount: formatToIndianCurrencyFormat(record.totalAmount),
      totalRefunded: formatToIndianCurrencyFormat(record.totalRefunded),
    }));

    const fields = [
      { label: 'Sl.no', value: 'SlNo' },
      { label: 'Created By', value: 'createdBy' },
      { label: 'Payment Method', value: 'paymentMethod' },
      { label: 'Total Amount', value: 'totalAmount' },
      { label: 'Total Refunded', value: 'totalRefunded' },
    ];

    const asyncParser = new AsyncParser({ fields });
    const csv = await asyncParser.parse(dataForCsv).promise();
    const csvWithBom = `\uFEFF${csv}`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="revenue_breakup_report.csv"`,
        'Access-Control-Allow-Origin': '*',
      },
      isBase64Encoded: true,
      body: Buffer.from(csvWithBom).toString('base64'),
    };
  } catch (error) {
    console.error('Error in revenue breakup CSV API:', error);
    return errorResponse(error);
  }
};
