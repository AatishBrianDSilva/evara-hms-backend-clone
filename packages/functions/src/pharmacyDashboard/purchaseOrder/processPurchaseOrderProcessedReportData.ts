import { IPurchaseOrder } from "@evara-backend/core/src/models/pharmacyDashboard/PurchaseOrder";
import {
  EBuckets,
  EDocumentTypes,
  EReportTemplateTypes,
  IReportData,
} from "@evara-backend/core/lib/types/global";
import _ from "lodash";

export const processPurchaseOrderProcessedReportData = (
  purchaseOrder: IPurchaseOrder,
  clinicId: string,
  response: any, // Response data passed here
  branch: any, // Pass branch data here
  vendor: any // Vendor passed here
): IReportData => {
  const reportData: IReportData = {
    bucket: EBuckets.PharmacyInvoices,
    documentType: EDocumentTypes.PurchaseOrderProcessed,
    templateType: EReportTemplateTypes.POInvoiceProcessed,
    reportName: `Updated Purchase Order Report for ${purchaseOrder.poNumber}`,
    fileName: _.kebabCase(`updated-purchase-order-${purchaseOrder.poNumber}`),
    sections: [],
    reportId: purchaseOrder.poNumber,
    clinic: clinicId,
    doctor: "", // No doctor for purchase orders
  };

  // Add Purchase Order Details Section with Response Data
  reportData.sections.push({
    showTitle: true,
    title: "Purchase Order Details",
    content: {
      "PO Number": purchaseOrder.poNumber,
      "Invoice Number": response.invoiceNumber || "N/A",
      "Net Amount": response.netAmount || "N/A",
      Date: new Date(purchaseOrder.createdAt).toLocaleDateString("en-GB"),
    },
  });

  let totalAmount = 0;

  // Add Items from Response
  const responseItems = response.items.map((item: any, index: number) => {
    const noOfPacks = item.noOfPacks || 0;
    const buyPrice = item.buyPrice || 0;
    const discountPercent = item.discount || 0;
    const taxPercent = item.tax || 0;

    // Calculate base amount before discount and tax
    const amount = buyPrice * noOfPacks;

    // Apply discount
    const discountAmount = (discountPercent / 100) * amount;

    // Calculate amount after discount
    const amountAfterDiscount = amount - discountAmount;

    // Calculate tax on the amount after discount
    const taxAmount = (taxPercent / 100) * amountAfterDiscount;

    // Calculate total amount (after discount and adding tax)
    const total = amountAfterDiscount + taxAmount;

    // Accumulate total amount
    totalAmount += total;

    console.log("Item at process report", item);

    return {
      Item: item.name || "N/A",
      "Batch No.": item.batchNo || "N/A",
      "Expiry Date": item.expiryDate
        ? new Date(item.expiryDate).toLocaleDateString("en-GB")
        : "N/A",
      Quantity: noOfPacks,
      "Rate (Per Pack)": buyPrice.toFixed(2),
      Amount: amount.toFixed(2),
      Discount: `${discountPercent}%`,
      GST: `${taxPercent}%`,
      Total: total.toFixed(2),
    };
  });

  reportData.sections.push({
    showTitle: true,
    title: "Processed Items",
    content: responseItems,
  });

  // Add Branch and Vendor Address Section
  const branchAddress = branch?.address
    ? `${branch.branchName}, ${branch.address.street || ""}, ${branch.address.city || ""}, ${
        branch.address.state || ""
      } - ${branch.address.zip || ""}`
    : "Branch address not available";

  const vendorAddress = vendor.address
    ? `${vendor.name}, ${vendor.address.addressLine1}, ${vendor.address.city}, ${
        vendor.address.state
      } - ${vendor.address.pincode}, TIN: ${vendor.tin || "N/A"}`
    : "Vendor address not available";

  reportData.sections.push({
    showTitle: true,
    title: "Address Information",
    content: {
      "Branch Address": branchAddress,
      "Vendor Address": vendorAddress,
    },
  });

  // Additional Details Section
  reportData.sections.push({
    showTitle: true,
    title: "Additional Details",
    content: {
      Subtotal: response.subTotal || "N/A",
      Discount: response.discount || "N/A",
      "Other Charges": response.otherCharges || "N/A",
      "Total Amount": totalAmount.toFixed(2), // Use the accumulated total amount
      TotalTax: response.tax || "N/A",
    },
  });

  return reportData;
};
