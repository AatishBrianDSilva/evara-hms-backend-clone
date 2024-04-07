import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import errorMessage from "@evara-backend/core/lib/utils/errorMessage";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/lib/utils/successResponse";
import {
  TaxRate,
  ITaxRate,
} from "@evara-backend/core/models/pharmacyDashboard/TaxRate";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();
    // Connect to MongoDB

    if (event.body == null) {
      throw new errorMessage(400, "Data is required");
    }

    // Parse the body from the event
    const data: ITaxRate = JSON.parse(event.body);
    const createdTaxRate = await TaxRate.create(data);

    return successResponse("Tax rate added successfully", createdTaxRate);
  } catch (error) {
    return errorResponse(error);
  }
};
