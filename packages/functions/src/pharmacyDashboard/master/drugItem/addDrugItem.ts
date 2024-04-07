import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import errorMessage from "@evara-backend/core/lib/utils/errorMessage";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/lib/utils/successResponse";
import {
  DrugItem,
  IDrugItem,
} from "@evara-backend/core/models/pharmacyDashboard/DrugItem";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();

    if (event.body == null) {
      throw new errorMessage(400, "Data is required");
    }

    const data: IDrugItem = JSON.parse(event.body);

    await DrugItem.create(data);

    return successResponse("Drug item added successfully");
  } catch (error) {
    return errorResponse(error);
  }
};
