import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";

import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import { TaxRate } from "@evara-backend/core/src/models/pharmacyDashboard/TaxRate";

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

    // const taxRate = await TaxRate.findByIdAndDelete(id);
    // console.log("Tax Rate", taxRate);

    const updatedDrugItem = await TaxRate.findByIdAndUpdate(
      id,
      { status: "Inactive" },
      { new: true }
    );

    return successResponse("Tax Rate Deleted Successfully", updatedDrugItem);
  } catch (error) {
    return errorResponse(error);
  }
};
