import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import errorMessage from "@evara-backend/core/lib/utils/errorMessage";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/lib/utils/successResponse";
import { DrugLocation } from "@evara-backend/core/models/pharmacyDashboard/DrugLocation";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();
    const branchId = "KL";
    const drugLocations = await DrugLocation.find({ branchId }).lean();
    return successResponse("success", drugLocations);
  } catch (error) {
    return errorResponse(error);
  }
};
