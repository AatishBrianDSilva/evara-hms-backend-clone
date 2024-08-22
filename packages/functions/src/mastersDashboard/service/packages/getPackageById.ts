import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import MasterPackage from "@evara-backend/core/src/models/patientDashboard/packages/MasterPackage";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    // Connect to MongoDB
    console.log("Connecting to MongoDB...");
    await connectMongoDb();
    console.log("Connected to MongoDB");

    // Check if the package ID is provided
    if (!event.pathParameters || !event.pathParameters.id) {
      console.log("Error: Package ID is required but not provided in path parameters.");
      throw new ErrorMessage(400, "Package ID is required");
    }

    const id = event.pathParameters.id;
    console.log("Package ID extracted from path parameters:", id);

    // Find package by ID
    console.log("Searching for package with ID:", id);
    const packageData = await MasterPackage.findById(id).lean();

    if (!packageData) {
      console.log("Error: Package not found with ID:", id);
      throw new ErrorMessage(404, "Package not found");
    }

    console.log("Package found:", packageData);

    // Return success response
    console.log("Returning success response with package data.");
    return successResponse("Success", packageData);
  } catch (error) {
    console.log("Error occurred during package retrieval:", error);
    return errorResponse(error);
  }
};
