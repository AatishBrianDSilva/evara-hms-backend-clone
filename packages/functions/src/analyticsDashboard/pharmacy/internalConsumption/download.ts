import { APIGatewayProxyHandler } from 'aws-lambda';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import { AsyncParser } from '@json2csv/node';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import { fetchInternalConsumptionData } from './internalConsumption';
import { formatToIndianCurrencyFormat } from '@evara-backend/core/lib/utils/formatToIndianCurrencyFormat';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;
  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) throw new Error('Unauthorized');

    const params = event.queryStringParameters || {};
    const {
      page = '1',
      limit = '25',
      saleStartDate,
      saleEndDate,
      allData = 'false',
    } = params;
    const fetchAllData = allData === 'true';

    // Fetch the same records as your dashboard
    const { records } = await fetchInternalConsumptionData({
      branchId: auth.branchId,
      page: fetchAllData ? undefined : parseInt(page, 10),
      limit: fetchAllData ? undefined : parseInt(limit, 10),
      saleStartDate,
      saleEndDate,
      fetchAllData,
    });

    // Map into exactly your columnsConfig order & names
    const dataForCsv = records.map((rec: any, idx: number) => ({
      SlNo: idx + 1,
      Centre: rec.centre,
      'Pharmacy Drug Name': rec.pharmacyDrugName,
      'Pharmacy Drug Code': rec.pharmacyDrugCode,
      'Location Name': rec.locationName,
      'Location Code': rec.locationCode,
      Category: rec.category,
      'Category Code': rec.categoryCode,
      Qty: rec.quantity,
      Cost: formatToIndianCurrencyFormat(rec.cost),
      'Sell Price': formatToIndianCurrencyFormat(rec.sellPrice),
      'Tax Rate': `${rec.taxRate ?? 0}%`,
      'Total Tax': formatToIndianCurrencyFormat(rec.totalTax),
      'Alloc Date': new Date(rec.allocDate).toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
      }),
      'Added By': rec.addedBy,
      Remarks: rec.remarks,
    }));

    // Define your CSV columns in order
    const fields = [
      { label: 'S No', value: 'SlNo' },
      { label: 'Centre', value: 'Centre' },
      { label: 'Pharmacy Drug Name', value: 'Pharmacy Drug Name' },
      { label: 'Pharmacy Drug Code', value: 'Pharmacy Drug Code' },
      { label: 'Location Name', value: 'Location Name' },
      { label: 'Location Code', value: 'Location Code' },
      { label: 'Category', value: 'Category' },
      { label: 'Category Code', value: 'Category Code' },
      { label: 'Qty', value: 'Qty' },
      { label: 'Cost', value: 'Cost' },
      { label: 'Sell Price', value: 'Sell Price' },
      { label: 'Tax Rate', value: 'Tax Rate' },
      { label: 'Total Tax', value: 'Total Tax' },
      { label: 'Alloc Date', value: 'Alloc Date' },
      { label: 'Added By', value: 'Added By' },
      { label: 'Remarks', value: 'Remarks' },
    ];

    // Generate CSV
    const asyncParser = new AsyncParser({ fields });
    const csv = await asyncParser.parse(dataForCsv).promise();
    const csvWithBom = `\uFEFF${csv}`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition':
          'attachment; filename="internal_consumption_report.csv"',
        'Access-Control-Allow-Origin': '*',
      },
      isBase64Encoded: true,
      body: Buffer.from(csvWithBom).toString('base64'),
    };
  } catch (err) {
    console.error('Error generating CSV:', err);
    return errorResponse(err);
  }
};
