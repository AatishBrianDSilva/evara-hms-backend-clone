import { APIGatewayProxyHandler } from 'aws-lambda';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import { AsyncParser } from '@json2csv/node';
import { fetchPurchaseOrderReportData } from './__purchaseOrder';
import { formatToIndianCurrencyFormat } from '@evara-backend/core/src/lib/utils/formatToIndianCurrencyFormat';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    const params = event.queryStringParameters || {};
    const {
      page = '1',
      limit = '25',
      status,
      vendorName,
      saleStartDate,
      saleEndDate,
      allData = 'false',
    } = params;

    const fetchAllData = allData === 'true';
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    const records = await fetchPurchaseOrderReportData({
      clinicId: auth.clinicId,
      branchId: auth.branchId,
      page: fetchAllData ? undefined : pageNumber,
      limit: fetchAllData ? undefined : limitNumber,
      status,
      vendorName,
      saleStartDate,
      saleEndDate,
      fetchAllData,
    });

    const startSlNo = fetchAllData ? 1 : (pageNumber - 1) * limitNumber + 1;
    const dataForCsv = records.map((record: any, index: number) => ({
      SlNo: startSlNo + index,
      poNumber: record.poNumber,
      date: record.date
        ? new Date(record.date).toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
          })
        : '—',
      vendorName: record.vendorName || '—',
      status: record.status || '—',
      invoiceNumbers: record.invoiceNumbers || '—',
      authorizedBy: record.authorizedBy || '—',
      netAmount: formatToIndianCurrencyFormat(record.netAmount || 0),
    }));

    const fields = [
      { label: 'Sl.no', value: 'SlNo' },
      { label: 'PO Number', value: 'poNumber' },
      { label: 'PO Date', value: 'date' },
      { label: 'Vendor Name', value: 'vendorName' },
      { label: 'Status', value: 'status' },
      { label: 'Invoice Number(s)', value: 'invoiceNumbers' },
      { label: 'Processed By', value: 'authorizedBy' },
      { label: 'Amount', value: 'netAmount' },
    ];

    const asyncParser = new AsyncParser({ fields });
    const csv = await asyncParser.parse(dataForCsv).promise();
    const csvWithBom = `\uFEFF${csv}`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition':
          'attachment; filename="purchase_order_report.csv"',
        'Access-Control-Allow-Origin': '*',
      },
      isBase64Encoded: true,
      body: Buffer.from(csvWithBom).toString('base64'),
    };
  } catch (error) {
    console.error('Error generating purchase order CSV:', error);
    return errorResponse(error);
  }
};
