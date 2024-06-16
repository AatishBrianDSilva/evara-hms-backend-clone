import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import MedicalTest, {
  ETestType,
  EBloodTestComponentType,
} from "@evara-backend/core/src/models/patientDashboard/investigation/MedicalTests";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    // Connect to MongoDB
    await connectMongoDb();

    if (!event.body) {
      throw new ErrorMessage(400, "Request body is required");
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    console.log("Data received:", data);

    // Validate that data is an object and contains required fields
    if (typeof data !== "object" || data === null) {
      throw new ErrorMessage(400, "Invalid data format");
    }

    if (data.testType !== ETestType.BloodTest) {
      throw new ErrorMessage(400, "Unsupported test type");
    }

    const { components, ...rest } = data;

    // Validate and format components
    const formattedComponents = (components || []).map((comp) => ({
      componentName: comp.componentName,
      componentType: comp.componentType || EBloodTestComponentType.Text, // Default to 'text' if componentType is missing
      options: comp.options || [], // Default to an empty array if options are not provided
      unit: comp.unit || "", // Default to an empty string if unit is not provided
      referenceRange: comp.referenceRange || "", // Default to an empty string if referenceRange is not provided
    }));

    // Create the BloodTest document
    const test = new MedicalTest({
      ...rest,
      components: formattedComponents,
    });

    console.log("Saving test:", test);

    // Save the BloodTest
    await test.save();
    console.log("Test saved successfully:", test);

    // Return success response
    return successResponse("BloodTest added successfully");
  } catch (error) {
    console.error("Error adding blood test:", error);
    return errorResponse(error);
  }
};
