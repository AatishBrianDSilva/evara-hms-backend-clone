import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";

import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import { TaxRate } from "@evara-backend/core/src/models/pharmacyDashboard/TaxRate";
import { DrugVendor } from "@evara-backend/core/src/models/pharmacyDashboard/DrugVendor";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();

    if (event.pathParameters === null) {
      throw new ErrorMessage(400, "Path parameters are null");
    }

    // Safely access the id property
    const id = event.pathParameters["id"];
    if (!id) {
      throw new ErrorMessage(400, "Id is not provided");
    }

    const taxRate = await DrugVendor.findById(id).lean();

    if (!taxRate) {
      throw new ErrorMessage(404, "Not found");
    }

    return successResponse("Fetched successfully", taxRate);
  } catch (error) {
    return errorResponse(error);
  }
};
