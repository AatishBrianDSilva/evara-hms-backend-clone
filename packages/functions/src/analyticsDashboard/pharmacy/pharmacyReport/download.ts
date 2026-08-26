import { APIGatewayProxyHandler } from 'aws-lambda';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import { AsyncParser } from '@json2csv/node';
import { fetchPharmacyReportData } from './__pharmacyReport';
import { formatToIndianCurrencyFormat } from '@evara-backend/core/src/lib/utils/formatToIndianCurrencyFormat';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    const params = event.queryStringParameters || {};
    const {
      page = '1',
      limit = '25',
      saleStartDate,
      saleEndDate,
      allData = 'false',
    } = params;

    const fetchAllData = allData === 'true';
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    const records = await fetchPharmacyReportData({
      clinicId: auth.clinicId,
      branchId: auth.branchId,
      page: fetchAllData ? undefined : pageNumber,
      limit: fetchAllData ? undefined : limitNumber,
      saleStartDate,
      saleEndDate,
      fetchAllData,
    });

    const startSlNo = fetchAllData ? 1 : (pageNumber - 1) * limitNumber + 1;
    const dataForCsv = records.map((record: any, index: number) => ({
      SlNo: startSlNo + index,
      date: record.date
        ? new Date(record.date).toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
          })
        : '—',
      patientId: record.patient || '—',
      patientName: record.patientName || '—',
      drugName: record.drugName || '—',
      quantity: record.totalQuantity ?? 0,
      totalSalesValue: formatToIndianCurrencyFormat(record.totalItemPrice || 0),
      expiryDate: record.expiryDate
        ? new Date(record.expiryDate).toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
          })
        : '—',
      hsnCode: record.hsnCode || '—',
      batchNumber: record.batchNumber || '—',
    }));

    const fields = [
      { label: 'Sl.no', value: 'SlNo' },
      { label: 'Date', value: 'date' },
      { label: 'Patient ID', value: 'patientId' },
      { label: 'Patient Name', value: 'patientName' },
      { label: 'Drug Name', value: 'drugName' },
      { label: 'Quantity', value: 'quantity' },
      { label: 'Total Sales Value', value: 'totalSalesValue' },
      { label: 'Expiry Date', value: 'expiryDate' },
      { label: 'HSN Code', value: 'hsnCode' },
      { label: 'Batch Number', value: 'batchNumber' },
    ];

    const asyncParser = new AsyncParser({ fields });
    const csv = await asyncParser.parse(dataForCsv).promise();
    const csvWithBom = `\uFEFF${csv}`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="pharmacy_report.csv"',
        'Access-Control-Allow-Origin': '*',
      },
      isBase64Encoded: true,
      body: Buffer.from(csvWithBom).toString('base64'),
    };
  } catch (error) {
    console.error('Error generating pharmacy report CSV:', error);
    return errorResponse(error);
  }
};
