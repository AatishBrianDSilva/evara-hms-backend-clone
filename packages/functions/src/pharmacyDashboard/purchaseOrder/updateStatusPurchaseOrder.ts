import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import errorMessage from "@evara-backend/core/lib/utils/errorMessage";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/lib/utils/successResponse";
import {
  EPurchaseOrderStatus,
  PurchaseOrder,
} from "@evara-backend/core/src/models/pharmacyDashboard/PurchaseOrder";

// Handler function for updating a single tax rate
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb(); // Connect to MongoDB

    if (!event.body) {
      throw new errorMessage(400, "Data is required");
    }

    const owner = "Admin"; // This should be the user ID of the user making the request

    // Assuming the event body will contain the ID of the tax rate to be updated and the new values
    const { id, status } = JSON.parse(event.body);

    if (!status) {
      throw new errorMessage(400, "Status is required for update");
    }

    if (!Object.values(EPurchaseOrderStatus).includes(status)) {
      throw new errorMessage(400, "Invalid status");
    }

    if (!id) {
      throw new errorMessage(400, "ID is required for update");
    }

    const updateData = {
      status,
      authorizedBy:
        status === EPurchaseOrderStatus.Approved ||
        status === EPurchaseOrderStatus.Rejected
          ? owner
          : undefined,
    };

    // Find by ID and update the tax rate
    const updatedData = await PurchaseOrder.findByIdAndUpdate(
      id,
      {
        $set: updateData,
      },
      {
        new: true, // Return the updated document
      }
    );

    if (!updatedData) {
      throw new errorMessage(404, "Data not found");
    }

    return successResponse("Status updated successfully", updatedData);
  } catch (error) {
    return errorResponse(error);
  }
};
