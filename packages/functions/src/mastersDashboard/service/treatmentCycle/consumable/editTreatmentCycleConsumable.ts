import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import MasterTreatmentCycle from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/MasterTreatmentCycle";
import { TreatmentCycleConsumable } from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/TreatmentCycleConsumable";

// Handler function for updating a single tax rate
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb(); // Connect to MongoDB

    if (!event.body) {
      throw new ErrorMessage(400, "Data is required");
    }

    if (event.pathParameters === null) {
      throw new ErrorMessage(400, "Path parameters are null");
    }

    // Safely access the id property
    const id = event.pathParameters["id"];
    if (!id) {
      throw new ErrorMessage(400, "Id is not provided");
    }

    // Assuming the event body will contain the ID of the tax rate to be updated and the new values
    const data = JSON.parse(event.body);

    // Find by ID and update the tax rate
    const updatedData = await TreatmentCycleConsumable.findByIdAndUpdate(
      id,
      data,
      {
        new: true, // Return the updated document
      }
    );

    if (!updatedData) {
      throw new ErrorMessage(404, "Consumable could not be updated");
    }

    return successResponse("Consumable updated successfully", updatedData);
  } catch (error) {
    return errorResponse(error);
  }
};
