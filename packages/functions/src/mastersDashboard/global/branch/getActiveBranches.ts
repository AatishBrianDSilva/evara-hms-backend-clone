import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";

import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import Branch from "@evara-backend/core/src/models/mastersDashboard/global/ClinicBranches";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb();

    const clinicId = event.queryStringParameters?.clinicId;
    if (!clinicId) {
      throw new ErrorMessage(400, "Clinic Id is required");
    }

    const branch = await Branch.find({
      isActive: true,
      clinicId: clinicId,
    }).sort({
      createdAt: -1,
    });

    const resp = branch.map((branch) => {
      return {
        branchId: branch.code,
        branchName: branch.code.trim() === "KN" ? "Kanpur" : branch.branchName,
      };
    });

    return successResponse("Success", resp);
  } catch (error) {
    return errorResponse(error);
  }
};
