import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import { User } from "@evara-backend/core/src/models/User";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";
import Branch from "@evara-backend/core/src/models/mastersDashboard/global/ClinicBranches";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb();
    // Connect to MongoDB
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, "Unauthorized");
    }

    if (event.pathParameters === null) {
      throw new ErrorMessage(400, "Path parameters are null");
    }

    // Safely access the id property
    const id = event.pathParameters["id"];
    if (!id) {
      throw new ErrorMessage(400, "Id is not provided");
    }

    if (!event.body) {
      throw new ErrorMessage(400, "Branch data is required");
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    // Check if the branch belongs to the authorized clinic
    const existingBranch = await Branch.findById(id);

    if (!existingBranch) {
      throw new ErrorMessage(404, "Branch not found or unauthorized");
    }

    // Prevent duplicate branch code in the same clinic
    if (data.code && data.code !== existingBranch.code) {
      const duplicateBranch = await Branch.findOne({
        clinicId: auth.clinicId,
        code: data.code,
      });

      if (duplicateBranch) {
        throw new ErrorMessage(409, "Branch code already exists");
      }
    }

    // Update the branch
    const updateFields = {
      code: data.code,
      branchName: data.branchName,
      address: data.address,
      phone: data.phone,
      email: data.email,
      manager: data.manager,
      isActive: data.isActive,
      deletedAt: data.deletedAt,
    };

    const updatedBranch = await Branch.findByIdAndUpdate(
      data.branchId,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updatedBranch) {
      throw new ErrorMessage(404, "Data not updated");
    }

    return successResponse("Branch updated successfully", updatedBranch);
  } catch (error) {
    return errorResponse(error);
  }
};
