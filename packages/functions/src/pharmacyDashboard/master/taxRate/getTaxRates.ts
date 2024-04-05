import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import errorMessage from "@evara-backend/core/lib/utils/errorMessage";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/lib/utils/successResponse";
import { TaxRate } from "@evara-backend/core/models/pharmacyDashboard/TaxRate";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();
    const taxRates = await TaxRate.find().lean();
    return successResponse("Tax bracket added successfully", taxRates);
  } catch (error) {
    return errorResponse(error);
  }
};
