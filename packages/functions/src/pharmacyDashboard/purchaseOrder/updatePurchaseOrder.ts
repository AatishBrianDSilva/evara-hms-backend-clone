import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { PurchaseOrder } from '@evara-backend/core/src/models/pharmacyDashboard/PurchaseOrder';
import { PharmacyInvoice } from '@evara-backend/core/models/pharmacyDashboard/PharmacyInvoice';
import { S3KeepPermanently, parseS3Url } from 'src/files/_KeepPermanently';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import SNSService from '@evara-backend/core/lib/aws/sns';
import { processPurchaseOrderProcessedReportData } from './processPurchaseOrderProcessedReportData';
import Branch from '@evara-backend/core/models/mastersDashboard/global/ClinicBranches';
import { DrugVendor } from '@evara-backend/core/models/pharmacyDashboard/DrugVendor';
import { DrugItem } from '@evara-backend/core/models/pharmacyDashboard/DrugItem';
import { updateStockFromPurchaseOrder } from '../stocks/updateStockFromPurchaseOrder';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const auth = extractAuthorizerDetails(event);

  const conn = await connectMongoDb();
  const session = await conn.startSession();
  session.startTransaction();

  try {
    if (!event.body) {
      throw new ErrorMessage(400, 'Data is required');
    }

    const data = JSON.parse(event.body);
    console.log('Parsed data:', JSON.stringify(data, null, 2));

    data.branchId = auth.branchId;
    data.clinicId = auth.clinicId;

    const branch = await Branch.findOne({
      code: new RegExp(`^${data.branchId.trim()}\\s*$`, 'i'),
      clinicId: data.clinicId,
      isActive: true,
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
    }).lean();

    if (!branch) {
      throw new ErrorMessage(404, 'Branch not found');
    }
    console.log('Branch found:', branch);

    // Fetch the vendor details using the vendor ID
    const vendorDetails = await DrugVendor.findById(data.vendor).lean();
    if (!vendorDetails) {
      throw new ErrorMessage(404, 'Vendor not found');
    }
    console.log('Vendor details:', vendorDetails);

    const { id, ...updateData } = JSON.parse(event.body);

    if (!id) {
      throw new ErrorMessage(400, 'ID is required for update');
    }

    console.log(`Updating purchase order with ID: ${id}`);
    console.log(`Update Data: ${JSON.stringify(updateData)}`);

    const purchaseOrder = await PurchaseOrder.findById(id);
    if (!purchaseOrder) {
      throw new ErrorMessage(404, 'Purchase order not found');
    }
    console.log('Purchase order found:', JSON.stringify(purchaseOrder));

    // Handle invoice file uploads
    const invoiceFileUrls = [];
    if (
      updateData.response?.invoice &&
      updateData.response?.invoice.length > 0
    ) {
      for (let i = 0; i < updateData.response.invoice.length; i++) {
        if (updateData.response.invoice[i].length > 0) {
          const s3UrlParts = parseS3Url(updateData.response.invoice[i]);

          if (s3UrlParts) {
            await S3KeepPermanently(s3UrlParts.bucketName, s3UrlParts.key);
            const invoicePart = s3UrlParts.key.split('/');
            invoiceFileUrls.push(updateData.response.invoice[i]);

            const pharmacyInvoice = new PharmacyInvoice({
              clinicId: auth.clinicId,
              branchId: auth.branchId,
              purchaseOrderId: purchaseOrder.poNumber,
              invoice: invoicePart[invoicePart.length - 1],
              bucket: s3UrlParts.bucketName,
              key: s3UrlParts.key,
              invoiceNumber: updateData.invoiceNumber || undefined,
            });
            console.log(
              `Saving Pharmacy Invoice: ${JSON.stringify(pharmacyInvoice)}`,
            );
            await pharmacyInvoice.save();
          } else {
            throw new ErrorMessage(400, 'Invalid image URL');
          }
        }
      }
    }

    // Initialize new response object for the current update
    const newResponse = {
      items: [],
      invoiceNumber: updateData.invoiceNumber,
      invoiceFileUrl: invoiceFileUrls,
      status: 'ProcessedWithoutUpdating',
      invoice: invoiceFileUrls, // Ensure the invoice file URLs are added to the invoice field
    };

    const newRequestItems = [];
    let requestSubTotal = 0;
    let requestTotalTax = 0;
    let responseSubTotal = 0;
    let responseTotalTax = 0;

    console.log('Processing items in the request...');
    // Process each item in the request
 // Maintain a map to track processed response items
const processedResponseItems = {};

updateData.request.items.forEach((item, index) => {
  console.log(
    `Processing request item ${index + 1}/${updateData.request.items.length}`,
  );
  console.log(`Request item data: ${JSON.stringify(item)}`);

  const packsRequired = item.packsRequired; // Total packs required
  const fulfilledPacks = item.noOfPacks || 0; // Fulfilled packs

  // Calculate the MRP and Tax for the fulfilled packs
  const itemMRP = (item.buyPrice || 0) * fulfilledPacks;
  const discountAmount = itemMRP * ((item.discount || 0) / 100);

  // Calculate actual subtotal after applying discount
  const actualSubTotal = itemMRP - discountAmount;

  // Calculate tax for the fulfilled packs (after discount is applied)
  const itemTax = (actualSubTotal * (item.tax || 0)) / 100;

  // Update response totals
  responseSubTotal += actualSubTotal;
  responseTotalTax += itemTax;

  if (fulfilledPacks > 0) {
    // Sequentially match an unprocessed response item
    const responseItemIndex = (processedResponseItems[item.item] || 0);
    const responseItem = updateData.response.items.filter(resItem => resItem.item === item.item)[responseItemIndex];

    if (responseItem) {
      // Increment the index for this item in the processed map
      processedResponseItems[item.item] = (processedResponseItems[item.item] || 0) + 1;

      // Push new response item with mapped fields
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
        discount: responseItem.discount || item.discount,
        batchNo: responseItem.batchNo || 'N/A',
        expiryDate: responseItem.expiryDate || null,
        status: 'ProcessedWithoutUpdating',
      });

      console.log(
        `Added to Response Items: ${JSON.stringify(
          newResponse.items[newResponse.items.length - 1],
        )}`,
      );
    } else {
      console.error(
        `No matching response item found for request item: ${JSON.stringify(
          item,
        )}`,
      );
    }
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
      batchNo: null,
      expiryDate: null,
      discount: item.discount,
      status: 'Pending',
    });

    console.log(
      `Unfulfilled item added with remaining packs: ${remainingPacks}`,
    );
  }
});

    console.log(`New Request Items: ${JSON.stringify(newRequestItems)}`);
    console.log(`New Response Items: ${JSON.stringify(newResponse)}`);

    // Calculate totals for request and response
    let requestDiscountAmount = 0;
    let responseDiscountAmount = 0;

    if (updateData.request.discount) {
      requestDiscountAmount =
        (requestSubTotal * updateData.request.discount) / 100;
    }

    if (updateData.response.discount) {
      responseDiscountAmount =
        (responseSubTotal * updateData.response.discount) / 100;
    }
    console.log('Response subtotal', responseSubTotal);
    console.log('Response discount', updateData.response.discount);

    const requestOtherCharges = updateData.request.otherCharges || 0;
    const responseOtherCharges = updateData.response.otherCharges || 0;

    const requestNetAmount =
      requestSubTotal -
      requestDiscountAmount +
      requestTotalTax +
      requestOtherCharges;
    const responseNetAmount =
      responseSubTotal -
      responseDiscountAmount +
      responseTotalTax +
      responseOtherCharges;

    console.log('Response subtotal', responseSubTotal);
    console.log('Response discount', responseDiscountAmount);

    console.log('Response tax', responseTotalTax);

    console.log('Response other charges', responseOtherCharges);

    console.log(`Request Net Amount: ${requestNetAmount}`);
    console.log(`Response Net Amount: ${responseNetAmount}`);

    // Update the request in the Purchase Order
    purchaseOrder.request.items = newRequestItems;
    purchaseOrder.request.subTotal = requestSubTotal;
    purchaseOrder.request.tax = requestTotalTax;
    purchaseOrder.request.discount = updateData.request.discount || 0;
    purchaseOrder.request.otherCharges = requestOtherCharges;
    purchaseOrder.request.netAmount = Math.round(requestNetAmount);

    // Set response totals
    newResponse.subTotal = responseSubTotal;
    newResponse.tax = responseTotalTax;
    newResponse.discount = updateData.response.discount || 0;
    newResponse.otherCharges = updateData.response.otherCharges || 0;
    newResponse.netAmount = Math.round(responseNetAmount);

    // Add the new response to the Purchase Order's responses array
    purchaseOrder.responses = purchaseOrder.responses || [];
    purchaseOrder.responses.push(newResponse);

    console.log(`Updated Purchase Order: ${JSON.stringify(purchaseOrder)}`);

    // Save the updated purchase order
    const updatedData = await purchaseOrder.save();
    console.log('Purchase order updated successfully.');

    // Fetch the item names for the updated response
    const itemIds = newResponse.items.map(item => item.item);
    const drugItems = await DrugItem.find({ _id: { $in: itemIds } }).lean();

    const updatedItemsWithNames = newResponse.items.map(item => {
      const drugItem = drugItems.find(
        di => di._id.toString() === item.item.toString(),
      );
      return {
        ...item,
        name: drugItem ? drugItem.name : 'Unknown Item', // Add item name to the response
      };
    });

    newResponse.items = updatedItemsWithNames;

    // Generate report data and send to SNS
    const reportData = processPurchaseOrderProcessedReportData(
      purchaseOrder,
      data.clinicId,
      newResponse,
      branch,
      vendorDetails,
    );

    console.log('Report data', reportData);

    await SNSService.publishMessage({
      Message: JSON.stringify(reportData),
      TopicArn: process.env.REPORT_HTML_GENERATION_TOPIC_ARN,
    });

    // Update stock from purchase order after saving the purchase order
    await updateStockFromPurchaseOrder(purchaseOrder._id, session);
    console.log('Stock updated from purchase order successfully.');

    await session.commitTransaction();
    session.endSession();

    return successResponse('Purchase order updated successfully', updatedData);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error updating purchase order:', error);
    return errorResponse(error);
  }
};
