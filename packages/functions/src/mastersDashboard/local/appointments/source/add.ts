import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";
import AppointmentSource from "@evara-backend/core/src/models/mastersDashboard/local/appointments/AppointmentSource";
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

    if (event.body == null) {
      throw new ErrorMessage(400, "User data is required");
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    const newDate = new AppointmentSource({
      ...data,
      clinicId: auth.clinicId,
      brachId: auth.branchId,
    });

    const res = await newDate.save();

    return successResponse("Successfully Added", res);
  } catch (error) {
    return errorResponse(error);
  }
};
