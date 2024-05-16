import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import Patients from "@evara-backend/core/models/Patients";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import Cases from "@evara-backend/core/models/Cases";
import Donor from "@evara-backend/core/models/mastersDashboard/local/Donor";
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    // Connect to MongoDB
    if (event.pathParameters === null) {
      throw new ErrorMessage(400, "Path parameters are null");
    }

    if (event.body == null) {
      throw new ErrorMessage(400, "Update data is required");
    }

    const id = event.pathParameters["id"];
    console.log("event.pathParameters", event.pathParameters);
    if (!id) {
      throw new ErrorMessage(400, "Patient Id is not provided");
    }

    await connectMongoDb();

    const body = JSON.parse(event.body);
    console.log("body", body);

    const updatedDonor = await Donor.findOneAndUpdate(
      { donorId: id },
      { $set: body },
      { new: true, runValidators: true } // Return the updated document and run schema validators
    ).lean();

    if (!updatedDonor) {
      throw new ErrorMessage(404, "Donor could not be updated");
    }

    // Return success response with updated patient data
    return successResponse("Donor updated successfully", updatedDonor);
  } catch (error) {
    // Rollback the transaction
    return errorResponse(error);
  } finally {
    // End the session
  }
};
