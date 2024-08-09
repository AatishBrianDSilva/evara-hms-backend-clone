import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import {
  TaxRate,
  ITaxRate,
} from "@evara-backend/core/models/pharmacyDashboard/TaxRate";
import { extractAuthorizerDetails } from "@evara-backend/core/lib/utils/extractAuthorizerDetails";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;
  const auth = extractAuthorizerDetails(event);

  try {
    await connectMongoDb();
    // Connect to MongoDB

    if (event.body == null) {
      throw new ErrorMessage(400, "Data is required");
    }

    // Parse the body from the event
    const data: ITaxRate = JSON.parse(event.body);

    data.clinicId = auth.clinicId;

    const createdTaxRate = await TaxRate.create(data);

    return successResponse("Tax rate added successfully", createdTaxRate);
  } catch (error) {
    return errorResponse(error);
  }
};
