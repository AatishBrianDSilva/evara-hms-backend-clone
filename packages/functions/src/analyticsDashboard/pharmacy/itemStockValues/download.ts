import { APIGatewayProxyHandler } from 'aws-lambda';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import { AsyncParser } from '@json2csv/node';
import { fetchItemStockValuesData } from './__itemStockValues';
import { formatToIndianCurrencyFormat } from '@evara-backend/core/src/lib/utils/formatToIndianCurrencyFormat';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    const params = event.queryStringParameters || {};
    const { page = '1', limit = '25', search = '', allData = 'false' } = params;

    const fetchAllData = allData === 'true';
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    const records = await fetchItemStockValuesData({
      clinicId: auth.clinicId,
      branchId: auth.branchId,
      page: fetchAllData ? undefined : pageNumber,
      limit: fetchAllData ? undefined : limitNumber,
      search,
      fetchAllData,
    });

    const startSlNo = fetchAllData ? 1 : (pageNumber - 1) * limitNumber + 1;
    const dataForCsv = records.map((record: any, index: number) => ({
      SlNo: startSlNo + index,
      drugName: record.drugName || '—',
      drugCode: record.drugCode || '—',
      hsnCode: record.hsnCode || '—',
      quantity: record.quantity ?? 0,
      totalCost: formatToIndianCurrencyFormat(record.totalCost || 0),
      totalMrp: formatToIndianCurrencyFormat(record.totalMrp || 0),
    }));

    const fields = [
      { label: 'Sl.no', value: 'SlNo' },
      { label: 'Drug Name', value: 'drugName' },
      { label: 'Drug Code', value: 'drugCode' },
      { label: 'HSN Code', value: 'hsnCode' },
      { label: 'Quantity', value: 'quantity' },
      { label: 'Total Cost', value: 'totalCost' },
      { label: 'Total MRP', value: 'totalMrp' },
    ];

    const asyncParser = new AsyncParser({ fields });
    const csv = await asyncParser.parse(dataForCsv).promise();
    const csvWithBom = `\uFEFF${csv}`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="item_stock_values.csv"',
        'Access-Control-Allow-Origin': '*',
      },
      isBase64Encoded: true,
      body: Buffer.from(csvWithBom).toString('base64'),
    };
  } catch (error) {
    console.error('Error generating item stock values CSV:', error);
    return errorResponse(error);
  }
};
