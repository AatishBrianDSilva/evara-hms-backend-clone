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
    if (!auth) throw new Error('Unauthorized access.');

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
    const isPaginate = paginate === 'true' && !fetchAllData;

    const { records } = await fetchSalesReportData({
      branchId: auth.branchId,
      page: fetchAllData ? undefined : parseInt(page, 10),
      limit: fetchAllData ? undefined : parseInt(limit, 10),
      paginate: isPaginate,
      saleStartDate,
      saleEndDate,
    });

    const dataForCsv = records.map((r: any, i: number) => ({
      SlNo: i + 1,
      SaleDate: new Date(r.saleDate).toLocaleDateString('en-IN'),
      PatientName: r.patientName,
      DoctorName: r.doctorName,
      Drug: r.pharmacyDrug,
      Category: r.drugCategory,
      Type: r.drugType,
      BatchNumber: r.batchNum,
      ExpiryDate: r.expiryDate
        ? new Date(r.expiryDate).toLocaleDateString('en-IN')
        : '',
      Quantity: r.quantity,
      BillAmount: formatToIndianCurrencyFormat(r.billAmount),
    }));

    const fields = [
      { label: 'Sl.no', value: 'SlNo' },
      { label: 'Sale Date', value: 'SaleDate' },
      { label: 'Patient Name', value: 'PatientName' },
      { label: 'Doctor Name', value: 'DoctorName' },
      { label: 'Drug', value: 'Drug' },
      { label: 'Category', value: 'Category' },
      { label: 'Type', value: 'Type' },

      { label: 'Quantity', value: 'Quantity' },
      { label: 'Bill Amount', value: 'BillAmount' },
    ];

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
