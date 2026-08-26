import { APIGatewayProxyHandler } from 'aws-lambda';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import { AsyncParser } from '@json2csv/node';
import { fetchPatientConsumptionData } from './__patientConsumption';
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
      search = '',
      allData = 'false',
    } = params;

    const fetchAllData = allData === 'true';
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    const records = await fetchPatientConsumptionData({
      clinicId: auth.clinicId,
      branchId: auth.branchId,
      page: fetchAllData ? undefined : pageNumber,
      limit: fetchAllData ? undefined : limitNumber,
      saleStartDate,
      saleEndDate,
      search,
      fetchAllData,
    });

    const startSlNo = fetchAllData ? 1 : (pageNumber - 1) * limitNumber + 1;
    const dataForCsv = records.map((record: any, index: number) => ({
      SlNo: startSlNo + index,
      patientId: record.patientId || '—',
      patientName: record.patientName || '—',
      totalQuantity: record.totalQuantity ?? 0,
      totalValue: formatToIndianCurrencyFormat(record.totalValue || 0),
      allocationCount: record.allocationCount ?? 0,
      lastDate: record.lastDate
        ? new Date(record.lastDate).toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
          })
        : '—',
    }));

    const fields = [
      { label: 'Sl.no', value: 'SlNo' },
      { label: 'Patient ID', value: 'patientId' },
      { label: 'Patient Name', value: 'patientName' },
      { label: 'Total Quantity', value: 'totalQuantity' },
      { label: 'Total Value', value: 'totalValue' },
      { label: 'Allocations', value: 'allocationCount' },
      { label: 'Last Dispense Date', value: 'lastDate' },
    ];

    const asyncParser = new AsyncParser({ fields });
    const csv = await asyncParser.parse(dataForCsv).promise();
    const csvWithBom = `\uFEFF${csv}`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition':
          'attachment; filename="patient_consumption_report.csv"',
        'Access-Control-Allow-Origin': '*',
      },
      isBase64Encoded: true,
      body: Buffer.from(csvWithBom).toString('base64'),
    };
  } catch (error) {
    console.error('Error generating patient consumption CSV:', error);
    return errorResponse(error);
  }
};
