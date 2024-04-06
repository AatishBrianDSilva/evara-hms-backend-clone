import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";

import successResponse from "@evara-backend/core/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/lib/utils/errorMessage";
import { DrugManufacturer } from "@evara-backend/core/src/models/pharmacyDashboard/DrugManufacturer";
import { DrugCategory } from "@evara-backend/core/src/models/pharmacyDashboard/DrugCategory";
import { TaxRate } from "@evara-backend/core/src/models/pharmacyDashboard/TaxRate";

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

    const data = await DrugManufacturer.findById(id)
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

    if (!data) {
      throw new ErrorMessage(404, "Not found");
    }

    return successResponse("Fetched successfully", data);
  } catch (error) {
    return errorResponse(error);
  }
};
