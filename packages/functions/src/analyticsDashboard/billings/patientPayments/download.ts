import { APIGatewayProxyHandler } from 'aws-lambda';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/src/lib/utils/extractAuthorizerDetails';
import { AsyncParser } from '@json2csv/node';
import { formatToIndianCurrencyFormat } from '@evara-backend/core/src/lib/utils/formatToIndianCurrencyFormat';
import { fetchPatientBillingsData } from './_patientPayments';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;
  try {
    const auth = extractAuthorizerDetails(event);
    const params = event.queryStringParameters || {};
    const {
      page = '1',
      limit = '10',
      status,
      paymentMethod,
      searchQuery = '',
      startDate,
      endDate,
      billType,
      allData = 'false',
    } = params;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const fetchAllData = allData === 'true';

    // Fetch data using the same reusable function
    const { records } = await fetchPatientBillingsData({
      clinicId: auth.clinicId,
      branchId: auth.branchId,
      page: fetchAllData ? undefined : pageNumber,
      limit: fetchAllData ? undefined : limitNumber,
      status,
      paymentMethod,
      searchQuery,
      startDate,
      endDate,
      billType,
      fetchAllData,
    });

    // Prepare data for CSV export with serial numbering
    let dataForCsv = records;
    if (!fetchAllData) {
      const startSlNo = (pageNumber - 1) * limitNumber + 1;
      dataForCsv = records.map((record: any, index: number) => ({
        SlNo: startSlNo + index,
        ...record,
      }));
    } else {
      dataForCsv = records.map((record: any, index: number) => ({
        SlNo: index + 1,
        ...record,
      }));
    }

    // Define CSV fields (including payment-wise details)
    const fields = [
      {
        label: 'Payment Date',
        value: (row: any) =>
          row.paymentDate
            ? new Date(row.paymentDate).toLocaleDateString('en-IN', {
                timeZone: 'Asia/Kolkata',
              })
            : '',
      },
      { label: 'Bill No.', value: 'billingId' },
      { label: 'Case ID', value: 'caseId' },
      { label: 'Patient ID', value: 'patientCode' },
      { label: 'Patient Name', value: 'patientName' },
      { label: 'Service', value: 'billType' },
      {
        label: 'Bill Amount',
        value: (row: any) => formatToIndianCurrencyFormat(row.billAmount),
      },
      {
        label: 'Taxable Value',
        value: (row: any) => formatToIndianCurrencyFormat(row.taxableValue),
      },
      {
        label: 'Tax',
        value: (row: any) => formatToIndianCurrencyFormat(row.tax),
      },
      {
        label: 'Discount',
        value: (row: any) => formatToIndianCurrencyFormat(row.discount),
      },
      {
        label: 'Subtotal',
        value: (row: any) => formatToIndianCurrencyFormat(row.totalValue),
      },
      {
        label: 'Net Payable',
        value: (row: any) => formatToIndianCurrencyFormat(row.subTotal),
      },
      {
        label: 'Payment Amount',
        value: (row: any) => formatToIndianCurrencyFormat(row.paymentAmount),
      },
      { label: 'Payment Method', value: 'paymentMethod' },
      { label: 'Payment Details', value: 'paymentDetails' },
    ];

    // Generate CSV using @json2csv/node
    const opts = { fields };
    const asyncParser = new AsyncParser(opts);
    const csv = await asyncParser.parse(dataForCsv).promise();

    // Add UTF-8 BOM to the CSV to ensure proper encoding in Excel
    const csvWithBom = `\uFEFF${csv}`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="patient_billings_report.csv"`,
        'Access-Control-Allow-Origin': '*',
      },
      isBase64Encoded: true,
      body: Buffer.from(csvWithBom).toString('base64'),
    };
  } catch (error) {
    console.error('Error in patientBillings CSV API: ', error);
    return errorResponse(error);
  }
};
