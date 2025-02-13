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
    if (!auth) {
      throw new Error('Unauthorized access.');
    }

    const params = event.queryStringParameters || {};
    const {
      page = '1',
      limit = '25',
      saleStartDate,
      saleEndDate,
      allData = 'false',
    } = params;

    const fetchAllData = allData === 'true';

    const { records } = await fetchInternalConsumptionData({
      branchId: auth.branchId,
      page: fetchAllData ? undefined : parseInt(page, 10),
      limit: fetchAllData ? undefined : parseInt(limit, 10),
      saleStartDate,
      saleEndDate,
      fetchAllData,
    });

    const dataForCsv = records.map((record: any, index: number) => ({
      SlNo: index + 1,
      centre: record.centre,
      pharmacyDrugName: record.pharmacyDrugName,
      pharmacyDrugCode: record.pharmacyDrugCode,
      locationName: record.locationName,
      locationCode: record.locationCode,
      category: record.category,
      categoryId: record.categoryId,
      quantity: record.quantity,
      unitCost: record.unitCost.toFixed(2),
      totalCost: record.totalCost.toFixed(2),
      totalTax: record.totalTax.toFixed(2),
      allocDate: new Date(record.allocDate).toLocaleDateString('en-IN'),
      addedBy: record.addedBy,
      remarks: record.remarks,
    }));

    const fields = [
      { label: 'Sl.no', value: 'SlNo' },
      { label: 'Centre', value: 'centre' },
      { label: 'Drug Name', value: 'pharmacyDrugName' },
      { label: 'Drug Code', value: 'pharmacyDrugCode' },
      { label: 'Location', value: 'locationName' },
      { label: 'Location Code', value: 'locationCode' },
      { label: 'Category', value: 'category' },
      { label: 'Category ID', value: 'categoryId' },
      { label: 'Quantity', value: 'quantity' },
      {
        label: 'Unit Cost',
        value: (row: any) => formatToIndianCurrencyFormat(row.unitCost),
      },
      {
        label: 'Total Cost',
        value: (row: any) => formatToIndianCurrencyFormat(row.totalCost),
      },
      {
        label: 'Total Tax',
        value: (row: any) => formatToIndianCurrencyFormat(row.totalTax),
      },
      { label: 'Allocation Date', value: 'allocDate' },
      { label: 'Added By', value: 'addedBy' },
      { label: 'Remarks', value: 'remarks' },
    ];

    const asyncParser = new AsyncParser({ fields });
    const csv = await asyncParser.parse(dataForCsv).promise();
    const csvWithBom = `\uFEFF${csv}`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="internal_consumption_report.csv"`,
        'Access-Control-Allow-Origin': '*',
      },
      isBase64Encoded: true,
      body: Buffer.from(csvWithBom).toString('base64'),
    };
  } catch (error) {
    console.error('Error generating Internal Consumption CSV:', error);
    return errorResponse(error);
  }
};
