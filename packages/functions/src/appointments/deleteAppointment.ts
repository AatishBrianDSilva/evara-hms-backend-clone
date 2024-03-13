import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "../../../core/src/lib/utils/errorResponse";
import ErrorMessage from "../../../core/src/lib/utils/errorMessage";
import successResponse from "../../../core/src/lib/utils/successResponse";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    // Connect to MongoDB
    if (event.body == null) {
      throw new ErrorMessage(400, "data is required");
    }
    const data = JSON.parse(event.body);
    // Parse the body from the event
    console.log(data);
    return successResponse("Success", data);
  } catch (error) {
    return errorResponse(error);
  }
};
