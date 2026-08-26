import { APIGatewayProxyHandler } from 'aws-lambda';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import { AsyncParser } from '@json2csv/node';
import { fetchPatientProceduresData } from './__procedure';
import { formatToIndianCurrencyFormat } from '@evara-backend/core/lib/utils/formatToIndianCurrencyFormat';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);

    const params = event.queryStringParameters || {};
    const {
      page = '1',
      limit = '10',
      status,
      search = '',
      startDate,
      endDate,
      allData = 'false',
    } = params;

    const fetchAllData = allData === 'true';
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    // Fetch patient procedures data
    const { records } = await fetchPatientProceduresData({
      clinicId: auth.clinicId,
      branchId: auth.branchId,
      page: fetchAllData ? undefined : pageNumber,
      limit: fetchAllData ? undefined : limitNumber,
      status,
      search,
      startDate,
      endDate,
      fetchAllData,
    });

    // Prepare CSV data
    const startSlNo = fetchAllData ? 1 : (pageNumber - 1) * limitNumber + 1;
    const dataForCsv = records.map((record: any, index: number) => ({
      SlNo: startSlNo + index,
      date: new Date(record.date).toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
      }),
      patientId: record.patientId,
      patientName: record.patientName,
      procedure: record.procedure,
      doctor: record.doctor,
      amount: formatToIndianCurrencyFormat(record.amount),
      status: record.status,
      discount:
        record.discount == null
          ? ''
          : formatToIndianCurrencyFormat(record.discount),
      netBilled:
        record.netBilled == null
          ? ''
          : formatToIndianCurrencyFormat(record.netBilled),
    }));

    // Define CSV fields
    const fields = [
      { label: 'Sl.no', value: 'SlNo' },
      { label: 'Date', value: 'date' },
      { label: 'Patient ID', value: 'patientId' },
      { label: 'Patient Name', value: 'patientName' },
      { label: 'Procedure', value: 'procedure' },
      { label: 'Doctor', value: 'doctor' },
      { label: 'Amount (list)', value: 'amount' },
      { label: 'Status', value: 'status' },
      { label: 'Discount', value: 'discount' },
      { label: 'Net Billed', value: 'netBilled' },
    ];

    // Generate CSV
    const asyncParser = new AsyncParser({ fields });
    const csv = await asyncParser.parse(dataForCsv).promise();

    // Add UTF-8 BOM for correct CSV encoding
    const csvWithBom = `\uFEFF${csv}`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition':
          'attachment; filename="patient_procedures_report.csv"',
        'Access-Control-Allow-Origin': '*',
      },
      isBase64Encoded: true,
      body: Buffer.from(csvWithBom).toString('base64'),
    };
  } catch (error) {
    console.error('Error generating CSV:', error);
    return errorResponse(error);
  }
};
