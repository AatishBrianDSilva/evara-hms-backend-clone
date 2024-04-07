import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/lib/utils/successResponse";
import { PharmacyStock } from "@evara-backend/core/models/pharmacyDashboard/PharmacyStock";
import { DrugItem } from "@evara-backend/core/src/models/pharmacyDashboard/DrugItem";
import { DrugVendor } from "@evara-backend/core/src/models/pharmacyDashboard/DrugVendor";
import { DrugLocation } from "@evara-backend/core/src/models/pharmacyDashboard/DrugLocation";
import ErrorMessage from "@evara-backend/core/src/lib/utils/errorMessage";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();

    if (event.pathParameters === null) {
      throw new ErrorMessage(400, "Path parameters are null");
    }

    // Safely access the id property
    const id = event.pathParameters["id"];
    if (!id) {
      throw new ErrorMessage(400, "Id is not provided");
    }

    const stocks = await PharmacyStock.findById(id)
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
