import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import {
  DrugType,
  IDrugType,
} from "@evara-backend/core/models/pharmacyDashboard/DrugType";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();

    if (event.body == null) {
      throw new ErrorMessage(400, "Data is required");
    }

    const data: IDrugType = JSON.parse(event.body);

    await DrugType.create(data);

    return successResponse("Drug Type added successfully");
  } catch (error) {
    return errorResponse(error);
  }
};
