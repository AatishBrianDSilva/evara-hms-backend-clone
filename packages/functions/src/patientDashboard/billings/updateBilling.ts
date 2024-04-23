import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import {
  PatientBilling,
  IPatientBilling,
} from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
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

    const {
      updates,
    }: {
      updates: Partial<Pick<IPatientBilling, "discount" | "total">>;
    } = JSON.parse(event.body);

    // Validate the updates - ensure only allowed fields are updated
    const updateKeys = Object.keys(updates);
    const allowedUpdates = ["discount", "total"];
    const isValidUpdate = updateKeys.every((key) =>
      allowedUpdates.includes(key)
    );

    if (!isValidUpdate) {
      throw new ErrorMessage(
        400,
        "Invalid update fields. Only 'discount' and 'total' can be updated."
      );
    }

    // Retrieve the existing billing document
    const billing = await PatientBilling.findById(id);
    if (!billing) {
      throw new ErrorMessage(404, "Billing document not found");
    }

    // Using findByIdAndUpdate to update the document directly
    const updatedBilling = await PatientBilling.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true } // Return the updated document and run validations
    );

    if (!updatedBilling) {
      throw new ErrorMessage(404, "Failed to update billing document");
    }

    return successResponse("Billing updated successfully", {
      updatedBilling,
    });
  } catch (error) {
    console.error("Error updating billing:", error);
    return errorResponse(error);
  }
};
