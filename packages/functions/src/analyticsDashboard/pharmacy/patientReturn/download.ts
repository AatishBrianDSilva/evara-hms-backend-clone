import { APIGatewayProxyHandler } from 'aws-lambda';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import { AsyncParser } from '@json2csv/node';
import { fetchPatientReturnData } from './__patientReturn';
import { formatToIndianCurrencyFormat } from '@evara-backend/core/src/lib/utils/formatToIndianCurrencyFormat';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);

    const params = event.queryStringParameters || {};
    const {
      page = '1',
      limit = '25',
      branchId = auth.branchId,
      startDate,
      endDate,
      patientName = '',
      drugName = '',
      allData = 'false',
    } = params;

    const fetchAllData = allData === 'true';
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    const { records } = await fetchPatientReturnData({
      clinicId: auth.clinicId,
      branchId,
      page: fetchAllData ? undefined : pageNumber,
      limit: fetchAllData ? undefined : limitNumber,
      startDate,
      endDate,
      patientName,
      drugName,
    });

    // Prepare CSV data
    const dataForCsv = records.map((record: any, index: number) => ({
      SlNo: fetchAllData
        ? index + 1
        : (pageNumber - 1) * limitNumber + 1 + index,
      branch: record.branch,
      returnedDate: new Date(record.returnedDate).toLocaleDateString('en-IN'),
      patientName: record.patientName,
      patientNumber: record.patientNumber,
      drugName: record.drugName,
      drugCode: record.drugCode,
      quantity: record.quantity,
      totalValue: formatToIndianCurrencyFormat(record.totalValue),
    }));

    // Define CSV fields
    const fields = [
      { label: 'Sl.no', value: 'SlNo' },
      { label: 'Branch', value: 'branch' },
      { label: 'Returned Date', value: 'returnedDate' },
      { label: 'Patient Name', value: 'patientName' },
      { label: 'Patient Number', value: 'patientNumber' },
      { label: 'Drug Name', value: 'drugName' },
      { label: 'Drug Code', value: 'drugCode' },
      { label: 'Quantity', value: 'quantity' },
      { label: 'Total Value', value: 'totalValue' },
    ];

    // Generate CSV
    const asyncParser = new AsyncParser({ fields });
    const csv = await asyncParser.parse(dataForCsv).promise();
    const csvWithBom = `\uFEFF${csv}`; // Add UTF-8 BOM for Excel compatibility

    // Return CSV as downloadable response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="patient_return_report.csv"`,
        'Access-Control-Allow-Origin': '*',
      },
      isBase64Encoded: true,
      body: Buffer.from(csvWithBom).toString('base64'),
    };
  } catch (error) {
    console.error('Error generating patient return CSV:', error);
    return errorResponse(error);
  }
};
