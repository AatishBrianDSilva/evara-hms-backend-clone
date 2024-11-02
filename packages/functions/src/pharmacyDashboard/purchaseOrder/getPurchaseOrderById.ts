import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import { DrugItem } from '@evara-backend/core/src/models/pharmacyDashboard/DrugItem';
import { TaxRate } from '@evara-backend/core/src/models/pharmacyDashboard/TaxRate';
import { DrugVendor } from '@evara-backend/core/src/models/pharmacyDashboard/DrugVendor';
import Branch from '@evara-backend/core/src/models/mastersDashboard/global/ClinicBranches';
import { PurchaseOrder } from '@evara-backend/core/src/models/pharmacyDashboard/PurchaseOrder';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb();

    if (!event.pathParameters || !event.pathParameters['id']) {
      throw new ErrorMessage(400, 'Id is not provided');
    }

    const id = event.pathParameters['id'];

    const populate = [
      {
        path: 'vendor',
        model: DrugVendor.modelName,
      },
      {
        path: 'request.items.item',
        model: DrugItem.modelName,
        populate: [
          {
            path: 'taxRate',
            model: TaxRate.modelName,
          },
        ],
      },
      {
        path: 'responses.items.item',
        model: DrugItem.modelName,
        populate: [
          {
            path: 'taxRate',
            model: TaxRate.modelName,
          },
        ],
      },
      {
        path: 'branch',
        model: Branch.modelName,
      },
      // No need to populate newAddress.branch since it's not a reference
    ];

    const data = await PurchaseOrder.findById(id).populate(populate).lean();

    if (!data) {
      throw new ErrorMessage(404, 'Not found');
    }

    // Check if `newAddress` field is present
    const isDifferentAddress = !!data.newAddress;

    // Add the `isDifferentAddress` boolean and `newAddress` fields to the response
    const response = {
      ...data,
      isDifferentAddress,
      newAddress: isDifferentAddress ? data.newAddress : null,
    };

    return successResponse('Fetched successfully', response);
  } catch (error) {
    return errorResponse(error);
  }
};
