import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import {
  EPurchaseOrderStatus,
  PurchaseOrder,
} from '@evara-backend/core/src/models/pharmacyDashboard/PurchaseOrder';
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

    const { id, ...payload } = data;

    if (!id) {
      throw new ErrorMessage(400, 'ID is required for update');
    }

    console.log(`Updating purchase order with ID: ${id}`);

    const purchaseOrder = await PurchaseOrder.findById(id);
    if (!purchaseOrder) {
      throw new ErrorMessage(404, 'Purchase order not found');
    }

    // Save the payload to payloadForAdminApproval field
    purchaseOrder.payloadForAdminApproval = payload;
    purchaseOrder.status = EPurchaseOrderStatus.AdminApprovalPending;

    const updatedData = await purchaseOrder.save();

    await session.commitTransaction();
    session.endSession();

    console.log('Payload added to Admin Approval and status updated.');
    return successResponse('Payload added successfully.', updatedData);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error adding payload for admin approval:', error);
    return errorResponse(error);
  }
};
