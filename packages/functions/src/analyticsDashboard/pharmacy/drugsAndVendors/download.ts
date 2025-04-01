import { APIGatewayProxyHandler } from 'aws-lambda';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import { AsyncParser } from '@json2csv/node';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import { formatToIndianCurrencyFormat } from '@evara-backend/core/lib/utils/formatToIndianCurrencyFormat';
import { fetchDrugItemsForCSV } from './__drugsAndVendors';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new Error('Unauthorized access.');
    }

    const params = event.queryStringParameters || {};
    const { drugName = '' } = params;

    // Fetch all drug items
    const records = await fetchDrugItemsForCSV({
      clinicId: auth.clinicId,
      drugName,
    });

    // Prepare data for CSV
    const dataForCsv = records.map((record: any, index: number) => ({
      SlNo: index + 1,
      drugCategory: record.drugCategory,
      categoryCode: record.categoryCode,
      drugType: record.drugType,
      typeCode: record.typeCode,
      drugCompany: record.drugCompany,
      companyCode: record.companyCode,
      drugName: record.drugName,
      genericName: record.genericName,
      drugCode: record.drugCode,
      hsnCode: record.hsnCode,
      qtyPerPack: record.qtyPerPack,
      lastUpdated: new Date(record.updatedAt).toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
      }),
    }));

    // Define CSV fields
    const fields = [
      { label: 'Sl.no', value: 'SlNo' },
      { label: 'Drug Category', value: 'drugCategory' },
      { label: 'Category Code', value: 'categoryCode' },
      { label: 'Drug Type', value: 'drugType' },
      { label: 'Type Code', value: 'typeCode' },
      { label: 'Drug Company', value: 'drugCompany' },
      { label: 'Company Code', value: 'companyCode' },
      { label: 'Drug Name', value: 'drugName' },
      { label: 'Generic Name', value: 'genericName' },
      { label: 'Drug Code', value: 'drugCode' },
      { label: 'HSN Code', value: 'hsnCode' },
      { label: 'Qty Per Pack', value: 'qtyPerPack' },
      { label: 'Last Updated', value: 'lastUpdated' },
    ];

    // Generate CSV
    const asyncParser = new AsyncParser({ fields });
    const csv = await asyncParser.parse(dataForCsv).promise();
    const csvWithBom = `\uFEFF${csv}`; // Add BOM for Excel compatibility

    // Return CSV response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="drug_items_report.csv"`,
        'Access-Control-Allow-Origin': '*',
      },
      isBase64Encoded: true,
      body: Buffer.from(csvWithBom).toString('base64'),
    };
  } catch (error) {
    console.error('Error generating drug items report CSV:', error);
    return errorResponse(error);
  }
};
