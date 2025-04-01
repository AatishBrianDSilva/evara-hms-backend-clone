import {
  EBuckets,
  EDocumentTypes,
  EReportTemplateTypes,
  IReportData,
} from '@evara-backend/core/lib/types/global';

export const processInternalConsumptionReportData = (
  internalConsumption: any,
  branch: any,
  stockItems: any[],
  drugItems: any[],
): IReportData => {
  // Create lookup maps
  const stockMap = new Map(stockItems.map(s => [s._id.toString(), s]));
  const drugMap = new Map(drugItems.map(d => [d._id.toString(), d]));

  const reportData: IReportData = {
    bucket: EBuckets.PharmacyInvoices,
    documentType: EDocumentTypes.InternalConsumption,
    templateType: EReportTemplateTypes.InternalConsumptionn,
    reportName: internalConsumption.icNumber,
    fileName: `debit-note-${internalConsumption.icNumber}`,
    sections: [],
    reportId: internalConsumption._id.toString(),
    clinic: internalConsumption.clinicId,
    doctor: '',
    branch: branch.code || branch._id,
  };

  reportData.sections.push({
    showTitle: true,
    title: 'Internal Consumption Details',
    content: {
      'Consumption ID': internalConsumption._id,
      'Branch Name': branch.branchName,
      Date: new Date(internalConsumption.date).toLocaleDateString('en-GB', {
        timeZone: 'Asia/Kolkata',
      }),
      'Created By': internalConsumption.createdBy,
      'Report Id': internalConsumption.icNumber,
    },
  });

  // 🔹 Process Items and ensure correct mapping
  const items = internalConsumption.items.map(item => {
    const stock = stockMap.get(item.item.toString()); // Ensure string comparison
    if (!stock) {
      console.warn(`❌ Missing stock details for item: ${item.item}`);
      return null;
    }

    const drugId = stock.item._id.toString(); // Extract DrugItem ID from stock
    const drug = drugMap.get(drugId);

    if (!drug) {
      console.warn(`❌ Missing Drug details for stock item: ${item.item}`);
      return null;
    }

    console.log(`✅ Mapped Drug for Stock Item: ${stock._id} -> ${drug.name}`);

    const taxRate = drug.taxRate || 0;
    const taxAmount = ((drug.mrp || 0) * item.quantity * taxRate) / 100;
    const amount = (drug.mrp || 0) * item.quantity + taxAmount;

    return {
      'Product Name': drug.name || 'N/A',
      'HSN Code': drug.hsnCode || 'N/A',
      Quantity: item.quantity || 0,
      'Unit Price': drug.mrp?.toFixed(2) || '0.00',
      'Tax (%)': taxRate,
      'Tax Amount': taxAmount.toFixed(2),
      Amount: amount.toFixed(2),
    };
  });

  reportData.sections.push({
    showTitle: true,
    title: 'Items',
    content: items.filter(i => i !== null), // Remove empty objects
  });

  // Add Address Information Section
  const branchAddress = branch.address
    ? `${branch.branchName}, ${branch.address.street || ''}, ${branch.address.city || ''}, ${branch.address.state || ''} - ${branch.address.zip || ''}`
    : 'Branch address not available';

  reportData.sections.push({
    showTitle: true,
    title: 'Address Information',
    content: {
      'Branch Address': branchAddress,
    },
  });

  return reportData;
};
