import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import errorMessage from "@evara-backend/core/lib/utils/errorMessage";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/lib/utils/successResponse";
import {
  IPatientBilling,
  PatientBilling,
} from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();
    // Connect to MongoDB

    if (!event.body) {
      throw new errorMessage(400, "Data is required");
    }

    const {
      billingId,
      updates,
    }: { billingId: string; updates: IPatientBilling } = JSON.parse(event.body);

    if (!billingId) {
      throw new errorMessage(400, "Billing ID is required");
    }

    // Retrieve the existing billing document
    const billing = await PatientBilling.findById(billingId);

    if (!billing) {
      throw new errorMessage(404, "Billing document not found");
    }

    // Using findByIdAndUpdate to update the document directly
    const updatedBilling = await PatientBilling.findByIdAndUpdate(
      billingId,
      { $set: updates },
      { new: true, runValidators: true } // options
    );

    if (!updatedBilling) {
      throw new errorMessage(404, "Billing document not found");
    }

    return successResponse("Billing updated successfully", {
      updatedBilling,
    });
  } catch (error) {
    return errorResponse(error);
  }
};
