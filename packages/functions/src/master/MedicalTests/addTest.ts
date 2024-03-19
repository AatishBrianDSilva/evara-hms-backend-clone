import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "../../../../core/src/lib/utils/errorResponse";
import ErrorMessage from "../../../../core/src/lib/utils/errorMessage";
import successResponse from "../../../../core/src/lib/utils/successResponse";
import MedicalTest from "../../../../core/src/models/MedicalTests";
import { connectMongoDb } from "../../../../core/src/lib/db/mongodb";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    // Connect to MongoDB
    await connectMongoDb();

    if (event.body == null) {
      throw new ErrorMessage(400, "Data is required");
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    //Array of objects. so bulk write

    // Loop through the data and create a new Master Investigation
    for (let i = 0; i < data.length; i++) {
      const test = new MedicalTest(data[i]);
      await test.save();
    }

    // Return success response
    return successResponse("Test Added successfully");
  } catch (error) {
    return errorResponse(error);
  }
};
