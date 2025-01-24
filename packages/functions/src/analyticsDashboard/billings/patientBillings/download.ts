// downloadPatientBillings.ts

import { APIGatewayProxyHandler } from 'aws-lambda';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import { AsyncParser } from '@json2csv/node';
import { fetchPatientBillingsData } from './__patientBillings';
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

    // Fetch data using the reusable function
    const { records } = await fetchPatientBillingsData({
      clinicId: auth.clinicId,
      branchId: auth.branchId,
      page: pageNumber,
      limit: limitNumber,
      status,
      paymentMethod,
      searchQuery,
      startDate,
      endDate,
      billType,
      fetchAllData,
    });

    // Prepare data for CSV
    let dataForCsv = records;

    // If not fetching all data, calculate the starting serial number
    if (!fetchAllData) {
      const startSlNo = (pageNumber - 1) * limitNumber + 1;
      // Add Sl.no to each record
      dataForCsv = records.map((record: any, index: number) => ({
        SlNo: startSlNo + index,
        ...record,
      }));
    } else {
      // For all data, just add sequential Sl.no
      dataForCsv = records.map((record: any, index: number) => ({
        SlNo: index + 1,
        ...record,
      }));
    }

    // Define the fields for the CSV
    const fields = [
      { label: 'Sl.no', value: 'SlNo' },
      {
        label: 'Date',
        value: (row: any) =>
          new Date(row.createdAt).toLocaleDateString('en-IN'),
      },
      { label: 'Billing ID', value: 'billingId' },
      { label: 'Patient Code', value: 'patientCode' },
      { label: 'Patient Name', value: 'patientName' },
      { label: 'Case ID', value: 'caseId' },
      { label: 'Status', value: 'status' },
      { label: 'Bill Type', value: 'billType' },
      {
        label: 'Amount',
        value: (row: any) => formatToIndianCurrencyFormat(row.amount),
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
        label: 'Sub Total',
        value: (row: any) => formatToIndianCurrencyFormat(row.subTotal),
      },
      {
        label: 'Total Paid',
        value: (row: any) => formatToIndianCurrencyFormat(row.totalPaid),
      },
      {
        label: 'Total Dues',
        value: (row: any) => formatToIndianCurrencyFormat(row.totalDues),
      },
    ];

    // Generate CSV using @json2csv/node
    const opts = { fields };
    const asyncParser = new AsyncParser(opts);
    const csv = await asyncParser.parse(dataForCsv).promise();
    console.log('Generated CSV:', csv);

    // Add UTF-8 BOM to the CSV
    const csvWithBom = `\uFEFF${csv}`;
    console.log('CSV with BOM:', csvWithBom);
    console.log('Base64 CSV:', Buffer.from(csvWithBom).toString('base64'));

    // Return the CSV file as a downloadable response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="patient_billings_report.csv"`,
        'Access-Control-Allow-Origin': '*', // Add CORS header if needed
      },
      isBase64Encoded: true,
      body: Buffer.from(csvWithBom).toString('base64'), // Base64 encode the CSV for binary download
    };
  } catch (error) {
    console.error('Error in patientBillings CSV API: ', error);
    return errorResponse(error);
  }
};
