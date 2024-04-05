import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import errorMessage from "@evara-backend/core/lib/utils/errorMessage";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/lib/utils/successResponse";
import { DrugManufacturer } from "@evara-backend/core/models/pharmacyDashboard/DrugManufacturer";
import { DrugCategory } from "@evara-backend/core/models/pharmacyDashboard/DrugCategory";
import { TaxRate } from "@evara-backend/core/src/models/pharmacyDashboard/TaxRate";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();
    const drugManufacturers = await DrugManufacturer.find()
      .populate([
        {
          path: "category",
          model: DrugCategory.modelName,
        },
        {
          path: "taxRate",
          model: TaxRate.modelName,
        },
      ])
      .lean();
    return successResponse("success", drugManufacturers);
  } catch (error) {
    return errorResponse(error);
  }
};
