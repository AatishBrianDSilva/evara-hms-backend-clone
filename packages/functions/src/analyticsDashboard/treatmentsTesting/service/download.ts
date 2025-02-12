import { APIGatewayProxyHandler } from 'aws-lambda';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import { AsyncParser } from '@json2csv/node';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import { fetchPatientServicesData } from './__service';
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
      status,
      allData = 'false',
    } = params;

    const fetchAllData = allData === 'true';
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    // Fetch patient services data
    const { records } = await fetchPatientServicesData({
      clinicId: auth.clinicId,
      branchId: auth.branchId,
      page: fetchAllData ? undefined : pageNumber,
      limit: fetchAllData ? undefined : limitNumber,
      startDate,
      endDate,
      search,
      status,
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
      { label: 'Date', value: 'date' },
      { label: 'Patient ID', value: 'patientId' },
      { label: 'Patient Name', value: 'patientName' },
      { label: 'Service', value: 'service' },
      { label: 'Doctor', value: 'doctor' },
      {
        label: 'Amount',
        value: (row: any) => formatToIndianCurrencyFormat(row.amount),
      },
      { label: 'Status', value: 'status' },
    ];

    // Generate CSV
    const asyncParser = new AsyncParser({ fields });
    const csv = await asyncParser.parse(dataForCsv).promise();

    // Add UTF-8 BOM to the CSV
    const csvWithBom = `\uFEFF${csv}`;

    // Return the CSV file as a downloadable response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="patient_services_report.csv"`,
        'Access-Control-Allow-Origin': '*',
      },
      isBase64Encoded: true,
      body: Buffer.from(csvWithBom).toString('base64'),
    };
  } catch (error) {
    console.error('Error generating patient services CSV:', error);
    return errorResponse(error);
  }
};
