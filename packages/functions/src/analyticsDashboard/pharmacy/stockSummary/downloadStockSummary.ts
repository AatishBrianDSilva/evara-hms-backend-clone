import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import { AsyncParser } from '@json2csv/node';
import { fetchStockData } from './__fetchStockData';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);

    await connectMongoDb();

    const params = event.queryStringParameters || {};
    const { search = '', allData = 'false' } = params;

    const fetchAllData = allData === 'true';

    // Fetch data using the reusable function
    const { records } = await fetchStockData({
      clinicId: auth.clinicId,
      branchId: auth.branchId,
      search,
      fetchAllData,
    });

    // Add Sl.no to each record
    records.forEach((record: any, index: number) => {
      record['SlNo'] = index + 1;
    });

    // Define the fields for the CSV
    const fields = [
      { label: 'Sl.no', value: 'SlNo' },
      { label: 'Drug Category', value: 'drugCategory' },
      { label: 'Drug Name', value: 'drugName' },
      { label: 'Drug Code', value: 'drugCode' },
      { label: 'Central', value: 'Central' },
      { label: 'OPD', value: 'OPD' },
      { label: 'OT', value: 'OT' },
      { label: 'Recovery', value: 'Recovery' },
      { label: 'IVF', value: 'IVF' },
      { label: 'Returns', value: 'Returns' },
      { label: 'Internal', value: 'Internal' },
      { label: 'Total Quantity', value: 'totalQuantity' },
      { label: 'Quantity On Hold', value: 'quantityOnHold' },
    ];

    // Generate CSV using @json2csv/node
    const opts = { fields };
    const asyncParser = new AsyncParser(opts);
    const csv = await asyncParser.parse(records).promise();

    // Return the CSV file as a downloadable response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="stock_report.csv"`,
        'Access-Control-Allow-Origin': '*', // Add CORS header if needed
      },
      isBase64Encoded: true,
      body: Buffer.from(csv).toString('base64'),
    };
  } catch (error) {
    console.error('Error in stockReport CSV API: ', error);
    return errorResponse(error);
  }
};
