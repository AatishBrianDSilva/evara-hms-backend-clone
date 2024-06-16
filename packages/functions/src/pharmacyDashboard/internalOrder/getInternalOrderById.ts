import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";

import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import { DrugItem } from "@evara-backend/core/src/models/pharmacyDashboard/DrugItem";
import { DrugLocation } from "@evara-backend/core/src/models/pharmacyDashboard/DrugLocation";
import { PharmacyStock } from "@evara-backend/core/src/models/pharmacyDashboard/PharmacyStock";
import { InternalOrder } from "@evara-backend/core/src/models/pharmacyDashboard/InternalOrder";
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, "Unauthorized");
    }
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
        path: "items.item",
        model: PharmacyStock.modelName,
        populate: [
          {
            path: "item",
            model: DrugItem.modelName,
          },
        ],
      },
      {
        path: "items.transferFrom.location",
        model: DrugLocation.modelName,
      },
      {
        path: "items.transferTo",
        model: DrugLocation.modelName,
      },
    ];

    const data = await InternalOrder.findById(id).populate(populate).lean();

    if (!data) {
      throw new ErrorMessage(404, "Not found");
    }

    console.log("Data", JSON.stringify(data, null, 2));

    return successResponse("Fetched successfully", data);
  } catch (error) {
    return errorResponse(error);
  }
};
