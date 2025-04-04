import { APIGatewayProxyHandler } from 'aws-lambda';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import { AsyncParser } from '@json2csv/node';
import { fetchHSNReportData } from './_hsnReport';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    const params = event.queryStringParameters || {};
    const { startDate, endDate, searchQuery = '' } = params;

    const { records } = await fetchHSNReportData({
      clinicId: auth.clinicId,
      branchId: auth.branchId,
      startDate,
      endDate,
      fetchAllData: true,
      searchQuery,
    });

    const dataWithSlNo = records.map((item: any, index: number) => ({
      SlNo: index + 1,
      ...item,
    }));

    const fields = [
      { label: 'Sl.No.', value: 'SlNo' },
      { label: 'HSN Code', value: 'hsnCode' },
      { label: 'Drug Name', value: 'drugName' },
      { label: 'Quantity', value: 'quantity' },
      { label: 'Taxable Value', value: 'taxableValue' },
      { label: 'Rate of Tax', value: 'rateOfTax' },
      { label: 'CGST', value: 'cgst' },
      { label: 'SGST', value: 'sgst' },
      { label: 'Net Taxable Value', value: 'netTaxableValue' },

      { label: 'Invoice Value', value: 'invoiceValue' },
    ];

    const parser = new AsyncParser({ fields });
    const csv = await parser.parse(dataWithSlNo).promise();
    const csvWithBom = `\uFEFF${csv}`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="hsn_report.csv"',
        'Access-Control-Allow-Origin': '*',
      },
      isBase64Encoded: true,
      body: Buffer.from(csvWithBom).toString('base64'),
    };
  } catch (error) {
    console.error('Error in HSN CSV download:', error);
    return errorResponse(error);
  }
};
