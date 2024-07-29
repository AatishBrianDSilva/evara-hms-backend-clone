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
    console.log("MongoDB connection established.");

    if (!event.body) {
      throw new ErrorMessage(400, "Data is required");
    }

    const { id, ...updateData } = JSON.parse(event.body);

    if (!id) {
      throw new ErrorMessage(400, "ID is required for update");
    }

    console.log(`Updating purchase order with ID: ${id}`);
    console.log(`Update Data: ${JSON.stringify(updateData)}`);

    const purchaseOrder = await PurchaseOrder.findById(id);
    if (!purchaseOrder) {
      throw new ErrorMessage(404, "Purchase order not found");
    }
    console.log("Purchase order found:", JSON.stringify(purchaseOrder));

    // Handle invoice file uploads
    const invoiceFileUrls = [];
    if (updateData.response?.invoice && updateData.response?.invoice.length > 0) {
      for (let i = 0; i < updateData.response.invoice.length; i++) {
        if (updateData.response.invoice[i].length > 0) {
          const s3UrlParts = parseS3Url(updateData.response.invoice[i]);

          if (s3UrlParts) {
            await S3KeepPermanently(s3UrlParts.bucketName, s3UrlParts.key);
            const invoicePart = s3UrlParts.key.split("/");
            invoiceFileUrls.push(updateData.response.invoice[i]);

            const pharmacyInvoice = new PharmacyInvoice({
              purchaseOrderId: purchaseOrder.poNumber,
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

    // Initialize new response object for the current update
    const newResponse = {
      items: [],
      invoiceNumber: updateData.invoiceNumber,
      invoiceFileUrl: invoiceFileUrls,
      status: "ProcessedWithoutUpdating",
      invoice: invoiceFileUrls, // Ensure the invoice file URLs are added to the invoice field
    };

    const newRequestItems = [];
    let requestSubTotal = 0;
    let requestTotalTax = 0;
    let responseSubTotal = 0;
    let responseTotalTax = 0;

    console.log("Processing items in the request...");
    // Process each item in the request
    updateData.request.items.forEach((item, index) => {
      console.log(`Processing request item ${index + 1}/${updateData.request.items.length}`);
      console.log(`Request item data: ${JSON.stringify(item)}`);

      const packsRequired = item.packsRequired; // Total packs required
      const fulfilledPacks = item.noOfPacks || 0; // Fulfilled packs

      // Calculate the MRP and Tax for the fulfilled packs
      const itemMRP = (item.buyPrice || 0) * fulfilledPacks;
      const itemTax = (itemMRP * (item.tax || 0)) / 100;

      // Update response totals
      responseSubTotal += itemMRP;
      responseTotalTax += itemTax;

      if (fulfilledPacks > 0) {
        // Use the correct index to access batchNo and expiryDate from updateData.response.items
        const responseItem = updateData.response.items.find(
          (resItem) => resItem.item === item.item
        );

        newResponse.items.push({
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
          batchNo: responseItem ? responseItem.batchNo : item.batchNo, // Correctly mapped batchNo
          expiryDate: responseItem ? responseItem.expiryDate : item.expiryDate, // Correctly mapped expiryDate
          status: "ProcessedWithoutUpdating",
        });
        console.log(
          `Added to Response Items: ${JSON.stringify(
            newResponse.items[newResponse.items.length - 1]
          )}`
        );
      }

      // Calculate remaining packs after fulfilling the current batch
      const remainingPacks = packsRequired - fulfilledPacks;
      console.log(`Remaining packs after fulfilling: ${remainingPacks}`);

      // If there are remaining packs, update newRequestItems with the remaining quantity
      if (remainingPacks > 0) {
        const remainingItemMRP = (item.buyPrice || 0) * remainingPacks;
        const remainingItemTax = (remainingItemMRP * (item.tax || 0)) / 100;

        requestSubTotal += remainingItemMRP;
        requestTotalTax += remainingItemTax;

        newRequestItems.push({
          item: item.item,
          packSize: item.packSize,
          quantity: remainingPacks * (item.packSize || 1),
          mrp: remainingItemMRP,
          mrpPerPack: item.mrpPerPack || 0,
          buyPrice: item.buyPrice || 0,
          tax: item.tax || 0,
          freeQuantity: item.freeQuantity || 0,
          noOfPacks: remainingPacks,
          packsRequired: item.packsRequired,
          batchNo: item.batchNo,
          expiryDate: item.expiryDate,
          status: "Pending",
        });
        console.log(`Unfulfilled item added with remaining packs: ${remainingPacks}`);
      }
    });

    console.log(`New Request Items: ${JSON.stringify(newRequestItems)}`);
    console.log(`New Response Items: ${JSON.stringify(newResponse)}`);

    // Calculate totals for request and response
    let requestDiscountAmount = 0;
    let responseDiscountAmount = 0;

    if (updateData.request.discount) {
      requestDiscountAmount = (requestSubTotal * updateData.request.discount) / 100;
    }

    if (updateData.response.discount) {
      responseDiscountAmount = (responseSubTotal * updateData.response.discount) / 100;
    }

    const requestOtherCharges = updateData.request.otherCharges || 0;
    const responseOtherCharges = updateData.response.otherCharges || 0;

    const requestNetAmount =
      requestSubTotal - requestDiscountAmount + requestTotalTax + requestOtherCharges;
    const responseNetAmount =
      responseSubTotal - responseDiscountAmount + responseTotalTax + responseOtherCharges;

    console.log(`Request Net Amount: ${requestNetAmount}`);
    console.log(`Response Net Amount: ${responseNetAmount}`);

    // Update the request in the Purchase Order
    purchaseOrder.request.items = newRequestItems;
    purchaseOrder.request.subTotal = requestSubTotal;
    purchaseOrder.request.tax = requestTotalTax;
    purchaseOrder.request.discount = updateData.request.discount || 0;
    purchaseOrder.request.otherCharges = requestOtherCharges;
    purchaseOrder.request.netAmount = requestNetAmount;

    // Set response totals
    newResponse.subTotal = responseSubTotal;
    newResponse.tax = responseTotalTax;
    newResponse.discount = updateData.response.discount || 0;
    newResponse.otherCharges = updateData.response.otherCharges || 0;
    newResponse.netAmount = responseNetAmount;

    // Add the new response to the Purchase Order's responses array
    purchaseOrder.responses = purchaseOrder.responses || [];
    purchaseOrder.responses.push(newResponse);

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
