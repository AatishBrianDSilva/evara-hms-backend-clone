import { APIGatewayProxyHandler } from 'aws-lambda';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import { AsyncParser } from '@json2csv/node';
import { fetchCriticalStocksData } from './__criticalStocks';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    const params = event.queryStringParameters || {};
    const {
      page = '1',
      limit = '25',
      drugName = '',
      allData = 'false',
    } = params;

    const fetchAllData = allData === 'true';

    const { records } = await fetchCriticalStocksData({
      branchId: auth.branchId,
      page: fetchAllData ? undefined : parseInt(page, 10),
      limit: fetchAllData ? undefined : parseInt(limit, 10),
      drugName,
      fetchAllData,
    });

    let dataForCsv = records.map((record: any, index: number) => ({
      SlNo: index + 1,
      drugName: record.drugName,
      drugCode: record.drugCode,
      drugCategory: record.drugCategory,
      totalQty: record.totalQty,
      criticalCount: record.criticalCount,
    }));

    const fields = [
      { label: 'Sl.no', value: 'SlNo' },
      { label: 'Drug Name', value: 'drugName' },
      { label: 'Drug Code', value: 'drugCode' },
      { label: 'Drug Category', value: 'drugCategory' },
      { label: 'Total Quantity', value: 'totalQty' },
      { label: 'Critical Count', value: 'criticalCount' },
    ];

    const asyncParser = new AsyncParser({ fields });
    const csv = await asyncParser.parse(dataForCsv).promise();
    const csvWithBom = `\uFEFF${csv}`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="critical_stocks_report.csv"`,
        'Access-Control-Allow-Origin': '*',
      },
      isBase64Encoded: true,
      body: Buffer.from(csvWithBom).toString('base64'),
    };
  } catch (error) {
    console.error('Error in critical stocks CSV API:', error);
    return errorResponse(error);
  }
};
