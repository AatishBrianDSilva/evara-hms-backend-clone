import { APIGatewayProxyHandler } from 'aws-lambda';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import { AsyncParser } from '@json2csv/node';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import { fetchExpiryDetailsData } from './__expiryDetails';
import { formatToIndianCurrencyFormat } from '@evara-backend/core/lib/utils/formatToIndianCurrencyFormat';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new Error('Unauthorized access.');
    }

    const params = event.queryStringParameters || {};
    const {
      page = '1',
      limit = '25',
      drugName = '',
      startDate,
      endDate,
      allData = 'false',
    } = params;
    const fetchAllData = allData === 'true';

    const { records } = await fetchExpiryDetailsData({
      branchId: auth.branchId,
      page: fetchAllData ? undefined : parseInt(page, 10),
      limit: fetchAllData ? undefined : parseInt(limit, 10),
      drugName,
      startDate,
      endDate,
      fetchAllData,
    });

    const dataForCsv = records.map((record: any, index: number) => ({
      SlNo: index + 1,
      centre: record.centre,
      invoiceNo: record.invoiceNo,
      vendorName: record.vendorName,
      drugCategory: record.drugCategory,
      drugName: record.drugName,
      batchNo: record.batchNo,
      expiryDate: record.expiryDate,
      unitCost: formatToIndianCurrencyFormat(record.unitCost),
      totalQty: record.totalQty,
      sumTotalValue: formatToIndianCurrencyFormat(record.sumTotalValue),
    }));

    const fields = [
      { label: 'Sl.no', value: 'SlNo' },
      { label: 'Center', value: 'centre' },
      { label: 'Invoice No.', value: 'invoiceNo' },
      { label: 'Vendor Name', value: 'vendorName' },
      { label: 'Drug Category', value: 'drugCategory' },
      { label: 'Drug Name', value: 'drugName' },
      { label: 'Batch No.', value: 'batchNo' },
      { label: 'Expiry Date', value: 'expiryDate' },
      { label: 'Unit Cost', value: 'unitCost' },
      { label: 'Total Quantity', value: 'totalQty' },
      { label: 'Total Value', value: 'sumTotalValue' },
    ];

    const asyncParser = new AsyncParser({ fields });
    const csv = await asyncParser.parse(dataForCsv).promise();
    const csvWithBom = `\uFEFF${csv}`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="expiry_details_report.csv"`,
        'Access-Control-Allow-Origin': '*',
      },
      isBase64Encoded: true,
      body: Buffer.from(csvWithBom).toString('base64'),
    };
  } catch (error) {
    console.error('Error generating Expiry Details CSV:', error);
    return errorResponse(error);
  }
};
