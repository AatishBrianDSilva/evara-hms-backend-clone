import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/lib/utils/successResponse";
import { DrugCategory } from "@evara-backend/core/models/pharmacyDashboard/DrugCategory";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();
    const drugCategories = await DrugCategory.find().lean();
    return successResponse("success", drugCategories);
  } catch (error) {
    return errorResponse(error);
  }
};
