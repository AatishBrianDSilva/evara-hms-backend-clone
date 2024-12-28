import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { PurchaseOrder } from '@evara-backend/core/src/models/pharmacyDashboard/PurchaseOrder';
import { updateStockFromPurchaseOrder } from '../stocks/updateStockFromPurchaseOrder';
import Branch from '@evara-backend/core/models/mastersDashboard/global/ClinicBranches';
import { DrugVendor } from '@evara-backend/core/models/pharmacyDashboard/DrugVendor';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const conn = await connectMongoDb();
  const session = await conn.startSession();
  session.startTransaction();

  try {
    if (!event.body) {
      throw new ErrorMessage(400, 'Data is required');
    }

    const { id, approval } = JSON.parse(event.body);

    if (!id) {
      throw new ErrorMessage(400, 'Purchase order ID is required.');
    }

    if (typeof approval !== 'boolean') {
      throw new ErrorMessage(400, 'Approval flag (true/false) is required.');
    }

    console.log(
      `Processing purchase order with ID: ${id}, Approval: ${approval}`,
    );

    const purchaseOrder = await PurchaseOrder.findById(id);
    if (!purchaseOrder) {
      throw new ErrorMessage(404, 'Purchase order not found.');
    }

    if (purchaseOrder.status !== 'AdminApprovalPending') {
      throw new ErrorMessage(
        400,
        'Purchase order is not in AdminApprovalPending status.',
      );
    }

    const payload = purchaseOrder.payloadForAdminApproval;
    if (!payload) {
      throw new ErrorMessage(400, 'No payload found for admin approval.');
    }

    console.log('Using saved payload for processing:', JSON.stringify(payload));

    const branch = await Branch.findOne({
      code: new RegExp(`^${purchaseOrder.branchId.trim()}\\s*$`, 'i'),
      clinicId: purchaseOrder.clinicId,
      isActive: true,
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
    }).lean();

    if (!branch) {
      throw new ErrorMessage(404, 'Branch not found.');
    }

    const vendorDetails = await DrugVendor.findById(
      purchaseOrder.vendor,
    ).lean();
    if (!vendorDetails) {
      throw new ErrorMessage(404, 'Vendor not found.');
    }

    // Handle Rejection Logic
    if (!approval) {
      purchaseOrder.status = 'RejectedByAdmin';
      purchaseOrder.payloadForAdminApproval = null;
      await purchaseOrder.save();

      await session.commitTransaction();
      session.endSession();

      return successResponse('Purchase order rejected by admin.', {
        id: purchaseOrder._id,
        status: purchaseOrder.status,
      });
    }

    // Processing Logic for Approved Orders
    const invoiceFileUrls = [];

    if (payload.response?.invoice && payload.response.invoice.length > 0) {
      for (const fileUrl of payload.response.invoice) {
        if (fileUrl.length > 0) {
          const s3UrlParts = parseS3Url(fileUrl);

          if (s3UrlParts) {
            await S3KeepPermanently(s3UrlParts.bucketName, s3UrlParts.key);
            const invoicePart = s3UrlParts.key.split('/');

            invoiceFileUrls.push(fileUrl);

            const pharmacyInvoice = new PharmacyInvoice({
              clinicId: purchaseOrder.clinicId,
              branchId: purchaseOrder.branchId,
              purchaseOrderId: purchaseOrder.poNumber,
              invoice: invoicePart[invoicePart.length - 1],
              bucket: s3UrlParts.bucketName,
              key: s3UrlParts.key,
              invoiceNumber: payload.invoiceNumber || undefined,
            });

            console.log(
              `Saving Pharmacy Invoice: ${JSON.stringify(pharmacyInvoice)}`,
            );
            await pharmacyInvoice.save();
          } else {
            throw new ErrorMessage(400, 'Invalid file URL format.');
          }
        }
      }
    }

    const newResponse = {
      items: [],
      invoiceNumber: payload.invoiceNumber,
      invoiceFileUrl: invoiceFileUrls,
      status: 'ProcessedWithoutUpdating',
      invoice: invoiceFileUrls,
    };

    const newRequestItems = [];
    let requestSubTotal = 0;
    let requestTotalTax = 0;
    let responseSubTotal = 0;
    let responseTotalTax = 0;

    console.log('Processing items in the saved payload...');
    const processedResponseItems = {};

    payload.request.items.forEach((item, index) => {
      console.log(
        `Processing request item ${index + 1}/${payload.request.items.length}`,
      );

      const packsRequired = item.packsRequired;
      const fulfilledPacks = item.noOfPacks || 0;

      const itemMRP = (item.buyPrice || 0) * fulfilledPacks;
      const discountAmount = itemMRP * ((item.discount || 0) / 100);
      const actualSubTotal = itemMRP - discountAmount;
      const itemTax = (actualSubTotal * (item.tax || 0)) / 100;

      responseSubTotal += actualSubTotal;
      responseTotalTax += itemTax;

      if (fulfilledPacks > 0) {
        const responseItemIndex = processedResponseItems[item.item] || 0;
        const responseItem = payload.response.items.filter(
          resItem => resItem.item === item.item,
        )[responseItemIndex];

        if (responseItem) {
          processedResponseItems[item.item] =
            (processedResponseItems[item.item] || 0) + 1;

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
        }
      }

      const remainingPacks = packsRequired - fulfilledPacks;
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
      }
    });

    purchaseOrder.request.items = newRequestItems;
    purchaseOrder.request.subTotal = requestSubTotal;
    purchaseOrder.request.tax = requestTotalTax;
    purchaseOrder.request.discount = payload.request.discount || 0;
    purchaseOrder.request.otherCharges = payload.request.otherCharges || 0;
    purchaseOrder.request.netAmount = Math.round(
      requestSubTotal -
        requestTotalTax +
        requestTotalTax +
        payload.request.otherCharges,
    );

    newResponse.subTotal = responseSubTotal;
    newResponse.tax = responseTotalTax;
    newResponse.discount = payload.response.discount || 0;
    newResponse.otherCharges = payload.response.otherCharges || 0;
    newResponse.netAmount = Math.round(
      responseSubTotal -
        responseTotalTax +
        responseTotalTax +
        payload.response.otherCharges,
    );

    purchaseOrder.responses = purchaseOrder.responses || [];
    purchaseOrder.responses.push(newResponse);

    const updatedData = await purchaseOrder.save();

    // Update stocks
    await updateStockFromPurchaseOrder(purchaseOrder._id, session);

    // purchaseOrder.payloadForAdminApproval = null;
    purchaseOrder.status = 'Processed';

    await session.commitTransaction();
    session.endSession();

    return successResponse(
      'Purchase order processed successfully.',
      updatedData,
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error processing purchase order:', error);
    return errorResponse(error);
  }
};
