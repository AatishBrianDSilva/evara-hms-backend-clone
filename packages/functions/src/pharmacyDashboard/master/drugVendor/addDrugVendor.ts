import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import {
  DrugVendor,
  IDrugVendor,
} from "@evara-backend/core/models/pharmacyDashboard/DrugVendor";
import { extractAuthorizerDetails } from "@evara-backend/core/lib/utils/extractAuthorizerDetails";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const auth = extractAuthorizerDetails(event);

  try {
    await connectMongoDb();

    if (event.body == null) {
      throw new ErrorMessage(400, "Data is required");
    }

    const data: IDrugVendor = JSON.parse(event.body);

    data.branchId = auth.branchId;
    data.clinicId = auth.clinicId;
    await DrugVendor.create(data);

    return successResponse("Drug Vendors added successfully");
  } catch (error) {
    return errorResponse(error);
  }
};
