import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";

import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import Branch from "@evara-backend/core/src/models/mastersDashboard/global/ClinicBranches";
import NotesObservation from "@evara-backend/core/src/models/mastersDashboard/local/notes/NotesObservation";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    const authorizer = extractAuthorizerDetails(event);
    if (!authorizer) {
      throw new ErrorMessage(401, "Unauthorized");
    }

    let query: any = {
      clinicId: authorizer.clinicId,
      branchId: authorizer.branchId,
    };

    await connectMongoDb();

    const data = await NotesObservation.find(query).sort({ createdAt: -1 });

    return successResponse("Success", data);
  } catch (error) {
    return errorResponse(error);
  }
};
