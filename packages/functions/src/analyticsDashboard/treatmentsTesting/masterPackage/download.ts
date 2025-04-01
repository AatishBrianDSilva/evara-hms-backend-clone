import { APIGatewayProxyHandler } from 'aws-lambda';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import { AsyncParser } from '@json2csv/node';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import { fetchMasterPackagesData } from './__masterPackage';
import { formatToIndianCurrencyFormat } from '@evara-backend/core/lib/utils/formatToIndianCurrencyFormat';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);

    const params = event.queryStringParameters || {};
    const {
      startDate,
      endDate,
      page = '1',
      limit = '10',
      search = '',
      allData = 'false',
    } = params;

    const fetchAllData = allData === 'true';
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    // Fetch master packages data
    const { records } = await fetchMasterPackagesData({
      clinicId: auth.clinicId,
      startDate,
      endDate,
      page: fetchAllData ? undefined : pageNumber,
      limit: fetchAllData ? undefined : limitNumber,
      search,
      fetchAllData,
    });

    // Add Sl.no to each record
    const dataForCsv = records.map((record: any, index: number) => ({
      SlNo: fetchAllData
        ? index + 1
        : (pageNumber - 1) * limitNumber + index + 1,
      ...record,
    }));

    // Define CSV fields
    const fields = [
      { label: 'Sl.no', value: 'SlNo' },
      { label: 'Name', value: 'name' },
      {
        label: 'Created Date',
        value: (row: any) =>
          new Date(row.createdAt).toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
          }),
      },

      { label: 'Investigations', value: 'investigations' },
      { label: 'Procedures', value: 'procedures' },
      { label: 'CryoPreservations', value: 'cryoPreservations' },
      { label: 'Services', value: 'services' },
      { label: 'Treatments', value: 'treatments' },
      {
        label: 'Price',
        value: (row: any) => formatToIndianCurrencyFormat(row.price),
      },
    ];

    // Generate CSV using @json2csv/node
    const asyncParser = new AsyncParser({ fields });
    const csv = await asyncParser.parse(dataForCsv).promise();

    // Add UTF-8 BOM to the CSV
    const csvWithBom = `\uFEFF${csv}`;

    // Return the CSV file as a downloadable response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="master_packages_report.csv"`,
        'Access-Control-Allow-Origin': '*',
      },
      isBase64Encoded: true,
      body: Buffer.from(csvWithBom).toString('base64'),
    };
  } catch (error) {
    console.error('Error generating master packages CSV:', error);
    return errorResponse(error);
  }
};
