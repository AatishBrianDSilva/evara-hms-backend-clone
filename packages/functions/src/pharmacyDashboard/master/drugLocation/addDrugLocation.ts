import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import errorMessage from "@evara-backend/core/lib/utils/errorMessage";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/lib/utils/successResponse";
import {
  DrugLocation,
  IDrugLocation,
} from "@evara-backend/core/models/pharmacyDashboard/DrugLocation";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();

    if (event.body == null) {
      throw new errorMessage(400, "Data is required");
    }

    const data: IDrugLocation[] = JSON.parse(event.body);

    for (const item of data) {
      item.branchId = "KL";
      await DrugLocation.create(item);
    }

    return successResponse("Drug Locations added successfully");
  } catch (error) {
    return errorResponse(error);
  }
};
