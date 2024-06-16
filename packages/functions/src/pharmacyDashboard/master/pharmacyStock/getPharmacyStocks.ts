import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { PharmacyStock } from "@evara-backend/core/models/pharmacyDashboard/PharmacyStock";
import { DrugItem } from "@evara-backend/core/src/models/pharmacyDashboard/DrugItem";
import { DrugVendor } from "@evara-backend/core/src/models/pharmacyDashboard/DrugVendor";
import { DrugLocation } from "@evara-backend/core/src/models/pharmacyDashboard/DrugLocation";
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, "Unauthorized");
    }

    await connectMongoDb();
    const stocks = await PharmacyStock.find({
      branchId: auth.branchId,
      clinicId: auth.clinicId,
    })
      .populate([
        {
          path: "item",
          model: DrugItem.modelName,
        },
        {
          path: "vendor",
          model: DrugVendor.modelName,
        },
        {
          path: "locations.location",
          model: DrugLocation.modelName,
        },
      ])
      .lean();
    return successResponse("success", stocks);
  } catch (error) {
    return errorResponse(error);
  }
};
