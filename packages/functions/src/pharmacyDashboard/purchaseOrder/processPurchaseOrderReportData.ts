import { IPurchaseOrder } from "@evara-backend/core/src/models/pharmacyDashboard/PurchaseOrder";
import {
  EBuckets,
  EDocumentTypes,
  EReportTemplateTypes,
  IReportData,
} from "@evara-backend/core/lib/types/global";
import _ from "lodash";

export const processPurchaseOrderReportData = (
  purchaseOrder: IPurchaseOrder,
  clinicId: string
): IReportData => {
  const reportData: IReportData = {
    bucket: EBuckets.PharmacyInvoices,
    documentType: EDocumentTypes.PurchaseOrder,
    templateType: EReportTemplateTypes.Reports,
    reportName: `Purchase Order Report for ${purchaseOrder.poNumber}`,
    fileName: _.kebabCase(`purchase-order-${purchaseOrder.poNumber}`),
    sections: [],
    reportId: purchaseOrder.poNumber,
    clinic: clinicId,
    doctor: "", // No doctor for purchase orders
  };

  // Add Purchase Order Details Section
  reportData.sections.push({
    showTitle: true,
    title: "Purchase Order Details",
    content: {
      "PO Number": purchaseOrder.poNumber,
      Vendor: purchaseOrder.vendor?.name || "N/A",
      "Net Amount": purchaseOrder.request?.netAmount || "N/A",
      Date: new Date(purchaseOrder.createdAt).toLocaleDateString("en-GB"),
    },
  });

  // Add Items Section
  const items = purchaseOrder.request?.items.map((item, index) => ({
    Item: item.item?.name || "N/A",
    Quantity: item.quantity,
    Price: item.buyPrice,
    Tax: item.tax,
    "Total Price": item.mrp,
  }));

  reportData.sections.push({
    showTitle: true,
    title: "Items",
    content: items,
  });

  // Any additional sections like Discounts, Taxes, or Other Charges
  reportData.sections.push({
    showTitle: true,
    title: "Additional Details",
    content: {
      Subtotal: purchaseOrder.request?.subTotal || "N/A",
      Discount: purchaseOrder.request?.discount || "N/A",
      "Other Charges": purchaseOrder.request?.otherCharges || "N/A",
      "Total Amount": purchaseOrder.request?.netAmount || "N/A",
    },
  });

  return reportData;
};
