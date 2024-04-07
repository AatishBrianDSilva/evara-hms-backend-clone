import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import errorMessage from "@evara-backend/core/lib/utils/errorMessage";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/lib/utils/successResponse";
import { TaxRate } from "@evara-backend/core/models/pharmacyDashboard/TaxRate";
import { DrugLocation } from "@evara-backend/core/src/models/pharmacyDashboard/DrugLocation";

// Handler function for updating a single tax rate
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb(); // Connect to MongoDB

    if (!event.body) {
      throw new errorMessage(400, "Data is required");
    }

    // Assuming the event body will contain the ID of the tax rate to be updated and the new values
    const { id, ...updateData } = JSON.parse(event.body);

    if (!id) {
      throw new errorMessage(400, "Drug Location ID is required for update");
    }

    // Find by ID and update the tax rate
    const updatedDrugLocation = await DrugLocation.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true, // Return the updated document
      }
    );

    if (!updatedDrugLocation) {
      throw new errorMessage(404, "Drug Location not found");
    }

    return successResponse(
      "Drug Location updated successfully",
      updatedDrugLocation
    );
  } catch (error) {
    return errorResponse(error);
  }
};
