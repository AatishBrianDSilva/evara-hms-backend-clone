import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import {
  PharmacyStock,
  IPharmacyStock,
} from "@evara-backend/core/models/pharmacyDashboard/PharmacyStock";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb();

    if (event.body == null) {
      throw new ErrorMessage(400, "Data is required");
    }

    const data: IPharmacyStock[] = JSON.parse(event.body);

    for (const item of data) {
      item.branchId = "KL";
      await PharmacyStock.create(item);
    }

    return successResponse("Stocks added successfully");
  } catch (error) {
    return errorResponse(error);
  }
};
