import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import errorMessage from "@evara-backend/core/lib/utils/errorMessage";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/lib/utils/successResponse";
import { DrugItem } from "@evara-backend/core/models/pharmacyDashboard/DrugItem";
import { DrugCategory } from "@evara-backend/core/models/pharmacyDashboard/DrugCategory";
import { TaxRate } from "@evara-backend/core/src/models/pharmacyDashboard/TaxRate";
import { DrugManufacturer } from "@evara-backend/core/src/models/pharmacyDashboard/DrugManufacturer";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();
    const drugItems = await DrugItem.find()
      .populate([
        {
          path: "category",
          model: DrugCategory.modelName,
        },
        {
          path: "taxRate",
          model: TaxRate.modelName,
        },
        {
          path: "manufacturer",
          model: DrugManufacturer.modelName,
        },
      ])
      .lean();
    return successResponse("success", drugItems);
  } catch (error) {
    return errorResponse(error);
  }
};
