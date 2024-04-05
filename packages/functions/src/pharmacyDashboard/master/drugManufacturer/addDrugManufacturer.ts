import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import errorMessage from "@evara-backend/core/lib/utils/errorMessage";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/lib/utils/successResponse";
import {
  DrugManufacturer,
  IDrugManufacturer,
} from "@evara-backend/core/models/pharmacyDashboard/DrugManufacturer";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();

    if (event.body == null) {
      throw new errorMessage(400, "Data is required");
    }

    const data: IDrugManufacturer[] = JSON.parse(event.body);

    for (const item of data) {
      item.status = "Active";
      await DrugManufacturer.create(item);
    }

    return successResponse("Drug Manufacture added successfully");
  } catch (error) {
    return errorResponse(error);
  }
};
