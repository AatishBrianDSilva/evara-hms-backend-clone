import { APIGatewayProxyHandler } from 'aws-lambda';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import { AsyncParser } from '@json2csv/node';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import { fetchSalesReportData } from './__salesBySchedule';
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
      paginate = 'true',
      saleStartDate,
      saleEndDate,
      allData = 'false',
    } = params;

    const fetchAllData = allData === 'true';
    const isPaginateEnabled = paginate === 'true';

    const { records } = await fetchSalesReportData({
      branchId: auth.branchId,
      page: fetchAllData ? undefined : parseInt(page, 10),
      limit: fetchAllData ? undefined : parseInt(limit, 10),
      paginate: !fetchAllData && isPaginateEnabled,
      saleStartDate,
      saleEndDate,
    });

    // Map data for CSV export
    const dataForCsv = records.map((record: any, index: number) => ({
      SlNo: index + 1,
      saleDate: new Date(record.saleDate).toLocaleDateString('en-IN'),
      patientName: record.patientName || 'N/A',
      doctorName: record.doctorName || 'N/A',
      pharmacyDrug: record.pharmacyDrug || 'N/A',
      drugCategory: record.drugCategory || 'N/A',
      drugType: record.drugType || 'N/A',
      batchNum: record.batchNum || 'N/A',
      expiryDate: record.expiryDate || 'N/A',
      quantity: record.quantity,
      billAmount: record.billAmount.toFixed(2),
    }));

    // Define fields for CSV export
    const fields = [
      { label: 'Sl.no', value: 'SlNo' },
      { label: 'Sale Date', value: 'saleDate' },
      { label: 'Patient Name', value: 'patientName' },
      { label: 'Doctor Name', value: 'doctorName' },
      { label: 'Pharmacy Drug', value: 'pharmacyDrug' },
      { label: 'Drug Category', value: 'drugCategory' },
      { label: 'Drug Type', value: 'drugType' },
      { label: 'Batch Number', value: 'batchNum' },
      { label: 'Expiry Date', value: 'expiryDate' },
      { label: 'Quantity', value: 'quantity' },
      {
        label: 'Bill Amount',
        value: (row: any) => formatToIndianCurrencyFormat(row.billAmount),
      },
    ];

    // Generate CSV
    const asyncParser = new AsyncParser({ fields });
    const csv = await asyncParser.parse(dataForCsv).promise();
    const csvWithBom = `\uFEFF${csv}`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="sales_report.csv"`,
        'Access-Control-Allow-Origin': '*',
      },
      isBase64Encoded: true,
      body: Buffer.from(csvWithBom).toString('base64'),
    };
  } catch (error) {
    console.error('Error generating sales report CSV:', error);
    return errorResponse(error);
  }
};
