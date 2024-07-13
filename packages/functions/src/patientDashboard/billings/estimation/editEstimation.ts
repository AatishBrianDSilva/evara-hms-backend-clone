import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";

import { findServiceByIdAndType } from "./addEstimation";
import { PatientBillingEstimation } from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBillingEstimation";

// Handler function to update estimation
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb();

    if (!event.pathParameters) {
      throw new ErrorMessage(400, "Path parameters are null");
    }

    const id = event.pathParameters["id"];
    if (!id) {
      throw new ErrorMessage(400, "Id is not provided");
    }

    if (!event.body) {
      throw new ErrorMessage(400, "Data is required");
    }

    const data = JSON.parse(event.body);

    // Find existing estimation
    const existingEstimation = await PatientBillingEstimation.findById(id);
    if (!existingEstimation) {
      throw new ErrorMessage(404, "Estimation not found");
    }

    // Optionally, find and validate new service if masterServiceId or serviceType is updated
    if (data.masterServiceId && data.serviceType) {
      const service = await findServiceByIdAndType(data.masterServiceId, data.serviceType);
      if (!service) {
        throw new ErrorMessage(404, "Service not found");
      }

      // Update price and tax calculations if service details are changed
      const estimatedPrice = service.cost * data.quantity;
      const estimatedTax = (service.tax * estimatedPrice) / 100;

      data.estimatedTax = estimatedTax;
      data.taxRate = service.tax;
      data.cost = service.cost;
      data.estimatedPrice = estimatedPrice;
      data.estimatedTotal = estimatedPrice + estimatedTax;
    }

    // Round the values to the nearest whole number
    if (data.estimatedTax) data.estimatedTax = Math.round(data.estimatedTax);
    if (data.estimatedPrice) data.estimatedPrice = Math.round(data.estimatedPrice);
    if (data.estimatedTotal) data.estimatedTotal = Math.round(data.estimatedTotal);

    // Update the estimation
    await PatientBillingEstimation.findByIdAndUpdate(id, {
      ...data,
    });

    return successResponse("Estimation updated successfully");
  } catch (error) {
    console.error("Error updating estimation:", error);
    return errorResponse(error);
  }
};
