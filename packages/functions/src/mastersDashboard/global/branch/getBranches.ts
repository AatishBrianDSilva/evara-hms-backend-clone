import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";

import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import Branch from "@evara-backend/core/src/models/mastersDashboard/global/ClinicBranches";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    const authorizer = extractAuthorizerDetails(event);
    if (!authorizer) {
      throw new ErrorMessage(401, "Unauthorized");
    }

    const params = event.queryStringParameters || {};
    const isAdmin = JSON.parse(params.isAdmin || "false");
    const isActive = JSON.parse(params.active || "false");

    let query: any = { clinicId: authorizer.clinicId };

    if (isAdmin) {
      query.isActive = isActive;
    }

    await connectMongoDb();

    const branch = await Branch.find(query).sort({ createdAt: -1 });

    return successResponse("Success", branch);
  } catch (error) {
    return errorResponse(error);
  }
};
