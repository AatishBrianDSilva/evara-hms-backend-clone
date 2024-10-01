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
  clinicId: string,
  branch: any, // Pass branch data here
  vendor: any, // Vendor passed here
  updatedItems: any[] // Updated items passed here with name and amount
): IReportData => {
  const reportData: IReportData = {
    bucket: EBuckets.PharmacyInvoices,
    documentType: EDocumentTypes.PurchaseOrder,
    templateType: EReportTemplateTypes.POInvoice,
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
      Vendor: vendor.name || "N/A",
      VendorTin: vendor.tin || "N/A",
      "Net Amount": purchaseOrder.request?.netAmount || "N/A",
      Date: new Date(purchaseOrder.createdAt).toLocaleDateString("en-GB"),
    },
  });

  const items = updatedItems.map((item, index) => {
    const noOfPacks = item.noOfPacks || 0;
    const buyPrice = item.buyPrice || 0;
    const discountPercent = item.discount || 0;
    const taxPercent = item.tax || 0;
    const freeQuantity = item.freeQuantity || 0;

    // Calculate the base amount before discount and tax
    const amount = buyPrice * noOfPacks;

    // Apply discount (discount is a percentage of the amount)
    const discountAmount = (discountPercent / 100) * amount;

    // Calculate amount after discount
    const amountAfterDiscount = amount - discountAmount;

    // Calculate the tax (GST) on the amount after discount
    const taxAmount = (taxPercent / 100) * amountAfterDiscount;

    // Calculate the total (amount after discount + tax)
    const total = amountAfterDiscount + taxAmount;

    // Return the correct values with proper formatting
    return {
      Item: item.name || "N/A",
      Quantity: noOfPacks,
      FreeQuantity: freeQuantity, // Include free quantity
      Rate: buyPrice.toFixed(2), // Buy Price per pack
      Amount: amount.toFixed(2), // Amount before discount and tax
      Discount: `${discountPercent}%`, // Discount in percentage
      GST: `${taxPercent}%`, // Tax percentage
      Total: total.toFixed(2), // Total (after discount and adding tax)
    };
  });
  reportData.sections.push({
    showTitle: true,
    title: "Items",
    content: items,
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

  // Additional sections like Discounts, Taxes, or Other Charges
  reportData.sections.push({
    showTitle: true,
    title: "Additional Details",
    content: {
      Subtotal: purchaseOrder.request?.subTotal || "N/A",
      Discount: purchaseOrder.request?.discount || "N/A",
      "Other Charges": purchaseOrder.request?.otherCharges || "N/A",
      "Total Amount": purchaseOrder.request?.netAmount
        ? purchaseOrder.request.netAmount.toFixed(2)
        : "N/A",
      TotalTax: purchaseOrder.request?.tax || "N/A",
    },
  });

  return reportData;
};
