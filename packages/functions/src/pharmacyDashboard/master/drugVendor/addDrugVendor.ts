import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import {
  DrugVendor,
  IDrugVendor,
} from "@evara-backend/core/models/pharmacyDashboard/DrugVendor";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();

    if (event.body == null) {
      throw new ErrorMessage(400, "Data is required");
    }

    const data: IDrugVendor = JSON.parse(event.body);

    data.branchId = "KL";
    await DrugVendor.create(data);

    return successResponse("Drug Vendors added successfully");
  } catch (error) {
    return errorResponse(error);
  }
};
