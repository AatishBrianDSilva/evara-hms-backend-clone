import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";

import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import { DrugItem } from "@evara-backend/core/src/models/pharmacyDashboard/DrugItem";
import { DrugCategory } from "@evara-backend/core/src/models/pharmacyDashboard/DrugCategory";
import { TaxRate } from "@evara-backend/core/src/models/pharmacyDashboard/TaxRate";
import { DrugType } from "@evara-backend/core/src/models/pharmacyDashboard/DrugType";
import { DrugManufacturer } from "@evara-backend/core/src/models/pharmacyDashboard/DrugManufacturer";
import { DrugVendor } from "@evara-backend/core/src/models/pharmacyDashboard/DrugVendor";
import Branch from "@evara-backend/core/src/models/mastersDashboard/global/ClinicBranches";
import { PurchaseOrder } from "@evara-backend/core/src/models/pharmacyDashboard/PurchaseOrder";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

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

    const populate = [
      {
        path: "vendor",
        model: DrugVendor.modelName,
      },
      {
        path: "request.items.item",
        model: DrugItem.modelName,
        populate: [
          {
            path: "taxRate",
            model: TaxRate.modelName,
          },
        ],
      },
      {
        path: "responses.items.item",
        model: DrugItem.modelName,
        populate: [
          {
            path: "taxRate",
            model: TaxRate.modelName,
          },
        ],
      },
      {
        path: "branch",
        model: Branch.modelName,
      },
    ];

    const data = await PurchaseOrder.findById(id).populate(populate).lean();

    if (!data) {
      throw new ErrorMessage(404, "Not found");
    }

    return successResponse("Fetched successfully", data);
  } catch (error) {
    return errorResponse(error);
  }
};
