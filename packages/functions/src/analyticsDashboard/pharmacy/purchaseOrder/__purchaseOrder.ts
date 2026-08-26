import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import { PurchaseOrder } from '@evara-backend/core/src/models/pharmacyDashboard/PurchaseOrder';
import { DrugVendor } from '@evara-backend/core/src/models/pharmacyDashboard/DrugVendor';
import { getISTDateRangeBounds } from '@evara-backend/core/src/lib/utils/formatDateIST';

interface FetchPurchaseOrderReportParams {
  clinicId: string;
  branchId: string;
  page?: number;
  limit?: number;
  status?: string;
  vendorName?: string;
  saleStartDate?: string;
  saleEndDate?: string;
  fetchAllData?: boolean;
}

export const fetchPurchaseOrderReportData = async (
  params: FetchPurchaseOrderReportParams,
) => {
  await connectMongoDb();

  const {
    clinicId,
    branchId,
    page = 1,
    limit = 25,
    status,
    vendorName,
    saleStartDate,
    saleEndDate,
    fetchAllData = false,
  } = params;

  const query: any = { clinicId, branchId };
  if (status) query.status = status;

  if (vendorName) {
    const matchingVendors = await DrugVendor.find({
      name: new RegExp(vendorName, 'i'),
    })
      .select('_id')
      .lean();
    const vendorIds = matchingVendors.map(vendor => vendor._id);
    if (vendorIds.length === 0) return [];
    query.vendor = { $in: vendorIds };
  }

  const { start, end } = getISTDateRangeBounds(saleStartDate, saleEndDate);
  if (start || end) {
    query.createdAt = {
      ...(start && { $gte: start }),
      ...(end && { $lte: end }),
    };
  }

  let recordsQuery = PurchaseOrder.find(query)
    .populate({ path: 'vendor', model: DrugVendor.modelName })
    .sort({ createdAt: -1 })
    .lean();

  if (!fetchAllData) {
    recordsQuery = recordsQuery.skip((page - 1) * limit).limit(limit);
  }

  const records = await recordsQuery;

  return records.map((record: any) => {
    const allResponsesNetAmount = (record.responses || []).reduce(
      (sum: number, response: any) => sum + (response.netAmount || 0),
      0,
    );
    const invoiceNumbers = [
      record.invoiceNumber,
      ...(record.responses || []).map((r: any) => r.invoiceNumber),
    ]
      .filter(Boolean)
      .join(', ');

    return {
      poNumber: record.poNumber,
      date: record.date,
      vendorName: record.vendor?.name || '',
      status: record.status,
      authorizedBy: record.authorizedBy || '',
      netAmount: allResponsesNetAmount,
      invoiceNumbers: invoiceNumbers || '—',
    };
  });
};
