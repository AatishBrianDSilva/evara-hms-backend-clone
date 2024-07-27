import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { PurchaseOrder } from "@evara-backend/core/src/models/pharmacyDashboard/PurchaseOrder";
import { PharmacyInvoice } from "@evara-backend/core/models/pharmacyDashboard/PharmacyInvoice";
import { S3KeepPermanently, parseS3Url } from "src/files/_KeepPermanently";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb(); // Connect to MongoDB

    if (!event.body) {
      throw new ErrorMessage(400, "Data is required");
    }

    const { id, ...updateData } = JSON.parse(event.body);

    if (!id) {
      throw new ErrorMessage(400, "ID is required for update");
    }

    console.log(`Updating partial purchase order with ID: ${id}`);
    console.log(`Update Data: ${JSON.stringify(updateData)}`);

    // Handle invoice file uploads
    if (updateData.response?.invoice && updateData.response?.invoice.length > 0) {
      for (let i = 0; i < updateData.response.invoice.length; i++) {
        if (updateData.response.invoice[i].length > 0) {
          const s3UrlParts = parseS3Url(updateData.response.invoice[i]);

          if (s3UrlParts) {
            await S3KeepPermanently(s3UrlParts.bucketName, s3UrlParts.key);
            const invoicePart = s3UrlParts.key.split("/");

            const po = await PurchaseOrder.findById(id).lean();
            console.log(`Fetched Purchase Order for invoice processing: ${JSON.stringify(po)}`);

            if (!po) {
              throw new ErrorMessage(404, "Purchase order not found for invoice processing.");
            }

            const pharmacyInvoice = new PharmacyInvoice({
              purchaseOrderId: po.poNumber,
              invoice: invoicePart[invoicePart.length - 1],
              bucket: s3UrlParts.bucketName,
              key: s3UrlParts.key,
              invoiceNumber: updateData.invoiceNumber || undefined,
            });
            console.log(`Saving Pharmacy Invoice: ${JSON.stringify(pharmacyInvoice)}`);
            await pharmacyInvoice.save();
          } else {
            throw new ErrorMessage(400, "Invalid image URL");
          }
        }
      }
    }

    const purchaseOrder = await PurchaseOrder.findById(id);
    if (!purchaseOrder) {
      throw new ErrorMessage(404, "Purchase order not found");
    }

    // Ensure request and response objects are initialized
    if (!purchaseOrder.request) {
      purchaseOrder.request = {
        items: [],
        subTotal: 0,
        tax: 0,
        discount: 0,
        otherCharges: 0,
        netAmount: 0,
      };
    }
    if (!purchaseOrder.response) {
      purchaseOrder.response = {
        items: [],
        subTotal: 0,
        tax: 0,
        discount: 0,
        otherCharges: 0,
        netAmount: 0,
      };
    }

    // Keep existing response items and add new ones
    const existingResponseItems = purchaseOrder.response.items || [];
    const newResponseItems = [];
    const newRequestItems = [];
    let responseSubTotal = 0;
    let responseTotalTax = 0;

    console.log("Processing items in the request...");
    // Process each item in the request
    updateData.request.items.forEach((item, index) => {
      console.log(`Processing request item ${index + 1}/${updateData.request.items.length}`);
      console.log(`Request item data: ${JSON.stringify(item)}`);

      const packsRequired = item.packsRequired; // Total packs required
      const fulfilledPacks = item.noOfPacks || 0; // Fulfilled packs

      // Find the corresponding response item details from updateData.response.items
      const responseItemDetails = updateData.response.items.find(
        (respItem) => respItem.item === item.item && respItem.batchNo && respItem.expiryDate
      );

      const batchNo = responseItemDetails ? responseItemDetails.batchNo : item.batchNo;
      const expiryDate = responseItemDetails ? responseItemDetails.expiryDate : item.expiryDate;

      const itemMRP = (item.buyPrice || 0) * fulfilledPacks;
      const itemTax = (itemMRP * (item.tax || 0)) / 100;

      // Add to response totals
      responseSubTotal += itemMRP;
      responseTotalTax += itemTax;

      if (fulfilledPacks > 0) {
        newResponseItems.push({
          item: item.item,
          packSize: item.packSize,
          quantity: fulfilledPacks * (item.packSize || 1),
          mrp: itemMRP,
          mrpPerPack: item.mrpPerPack || 0,
          buyPrice: item.buyPrice || 0,
          tax: item.tax || 0,
          freeQuantity: item.freeQuantity || 0,
          noOfPacks: fulfilledPacks,
          packsRequired: item.packsRequired,
          batchNo, // Use batchNo from response item
          expiryDate, // Use expiryDate from response item
          status: "NewlyProcessed", // Mark as newlyProcessed for the new items
        });
        console.log(
          `Added to Response Items: ${JSON.stringify(
            newResponseItems[newResponseItems.length - 1]
          )}`
        );
      }

      // Add remaining items to request
      const remainingPacks = packsRequired - fulfilledPacks;
      if (remainingPacks > 0) {
        newRequestItems.push({
          item: item.item,
          packSize: item.packSize,
          quantity: remainingPacks * (item.packSize || 1),
          mrp: (item.buyPrice || 0) * remainingPacks,
          mrpPerPack: item.mrpPerPack || 0,
          buyPrice: item.buyPrice || 0,
          tax: item.tax || 0,
          freeQuantity: item.freeQuantity || 0,
          noOfPacks: remainingPacks,
          packsRequired: item.packsRequired,
          batchNo: item.batchNo,
          expiryDate: item.expiryDate,
          status: "Pending", // Keep status as Pending for remaining items
        });
      }
    });

    // Combine old response items with new items
    const updatedResponseItems = [...existingResponseItems, ...newResponseItems];

    // Calculate totals for response
    let responseDiscountAmount = 0;

    if (updateData.response.discount) {
      responseDiscountAmount = (responseSubTotal * updateData.response.discount) / 100;
    }

    const responseOtherCharges = updateData.response.otherCharges || 0;

    const responseNetAmount =
      responseSubTotal - responseDiscountAmount + responseTotalTax + responseOtherCharges;

    // Update the response in the Purchase Order
    purchaseOrder.response.items = updatedResponseItems;
    purchaseOrder.response.subTotal = existingResponseItems.reduce(
      (acc, item) => acc + (item.mrp || 0),
      0
    );
    purchaseOrder.response.tax = existingResponseItems.reduce(
      (acc, item) => acc + ((item.mrp || 0) * (item.tax || 0)) / 100,
      0
    );
    purchaseOrder.response.discount = updateData.response.discount || 0;
    purchaseOrder.response.otherCharges = updateData.response.otherCharges || 0;
    purchaseOrder.response.netAmount =
      purchaseOrder.response.subTotal -
      responseDiscountAmount +
      purchaseOrder.response.tax +
      responseOtherCharges;

    // Update the request in the Purchase Order
    purchaseOrder.request.items = newRequestItems;
    purchaseOrder.request.subTotal = updateData.request.subTotal || 0;
    purchaseOrder.request.tax = updateData.request.tax || 0;
    purchaseOrder.request.discount = updateData.request.discount || 0;
    purchaseOrder.request.otherCharges = updateData.request.otherCharges || 0;
    purchaseOrder.request.netAmount = updateData.request.netAmount || 0;

    console.log(`Updated Purchase Order: ${JSON.stringify(purchaseOrder)}`);

    // Save the updated purchase order
    const updatedData = await purchaseOrder.save();
    console.log("Purchase order updated successfully.");

    return successResponse("Purchase order updated successfully", updatedData);
  } catch (error) {
    console.error("Error updating purchase order:", error);
    return errorResponse(error);
  }
};
