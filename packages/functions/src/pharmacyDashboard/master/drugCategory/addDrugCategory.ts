import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import {
  DrugCategory,
  IDrugCategory,
} from "@evara-backend/core/models/pharmacyDashboard/DrugCategory";
import { extractAuthorizerDetails } from "@evara-backend/core/lib/utils/extractAuthorizerDetails";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;
  const auth = extractAuthorizerDetails(event);

  if (auth.clinicId == null) {
    throw new ErrorMessage(400, "Clinic ID is required");
  }

  try {
    await connectMongoDb();

    if (event.body == null) {
      throw new ErrorMessage(400, "Data is required");
    }

    const data: IDrugCategory = JSON.parse(event.body);

    data.clinicId = auth.clinicId;

    await DrugCategory.create(data);

    return successResponse("Drug Category added successfully");
  } catch (error) {
    return errorResponse(error);
  }
};
