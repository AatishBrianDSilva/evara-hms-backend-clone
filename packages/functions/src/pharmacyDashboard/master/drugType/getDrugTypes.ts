import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/lib/utils/successResponse";
import { DrugType } from "@evara-backend/core/models/pharmacyDashboard/DrugType";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();
    const drugTypes = await DrugType.find().lean();
    return successResponse("success", drugTypes);
  } catch (error) {
    return errorResponse(error);
  }
};
