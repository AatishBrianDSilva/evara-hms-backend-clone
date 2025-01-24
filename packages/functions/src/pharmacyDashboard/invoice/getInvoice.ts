import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { PharmacyInvoice } from '@evara-backend/core/models/pharmacyDashboard/PharmacyInvoice';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb();

    const invoices = await PharmacyInvoice.aggregate([
      {
        $lookup: {
          from: 'purchaseorders', // Name of the PurchaseOrder collection
          localField: 'purchaseOrderId',
          foreignField: 'poNumber', // Match using poNumber
          as: 'purchaseOrder',
        },
      },
      {
        $unwind: {
          path: '$purchaseOrder',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'drugvendors', // Name of the DrugVendor collection
          localField: 'purchaseOrder.vendor',
          foreignField: '_id',
          as: 'vendor',
        },
      },
      {
        $unwind: {
          path: '$vendor',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          vendorName: '$vendor.name',
          totalAmount: {
            $sum: '$purchaseOrder.responses.netAmount', // Calculate total netAmount
          },
        },
      },
      {
        $project: {
          _id: 1,
          clinicId: 1,
          branchId: 1,
          purchaseOrderId: 1,
          invoice: 1,
          invoiceNumber: 1,
          createdAt: 1,
          updatedAt: 1,
          vendorName: 1,
          totalAmount: 1,
        },
      },
    ]);

    return successResponse('Fetched invoices successfully', invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return errorResponse(error);
  }
};
