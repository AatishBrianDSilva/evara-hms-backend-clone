import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "../../../../core/src/lib/utils/errorResponse";
import ErrorMessage from "../../../../core/src/lib/utils/errorMessage";
import successResponse from "../../../../core/src/lib/utils/successResponse";
import MedicalTest, {
  ETestType,
} from "../../../../core/src/models/MedicalTests";
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

    // Loop through the data and create a new Master Investigation
    for (let i = 0; i < data.length; i++) {
      if (data[i].testType === ETestType.BloodTest) {
        const { components, ...rest } = data[i];
        const test = new MedicalTest({
          ...rest,
          ...(components ? { components: components } : {}),
        });
        await test.save();
      } else {
        const { components, ...rest } = data[i];
        const test = new MedicalTest(rest);
        await test.save();
      }
    }

    // Return success response
    return successResponse("Test(s) Added successfully");
  } catch (error) {
    return errorResponse(error);
  }
};
