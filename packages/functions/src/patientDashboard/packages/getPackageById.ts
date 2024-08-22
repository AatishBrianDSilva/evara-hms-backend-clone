import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import MasterPackage from "@evara-backend/core/models/patientDashboard/packages/MasterPackage";
import PatientPackage from "@evara-backend/core/models/patientDashboard/packages/PatientPackage";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    console.log("Connecting to MongoDB...");
    await connectMongoDb();
    console.log("Connected to MongoDB.");

    if (event.pathParameters === null) {
      console.error("Path parameters are null.");
      throw new ErrorMessage(400, "Path parameters are null");
    }

    const id = event.pathParameters["id"];
    if (!id) {
      console.error("ID is not provided in path parameters.");
      throw new ErrorMessage(400, "Id is not provided");
    }

    console.log(`Fetching PatientPackage with ID: ${id}`);
    const patientPackage = await PatientPackage.findById(id)
      .populate([
        {
          path: "package",
          model: MasterPackage.modelName,
        },
      ])
      .lean();

    if (!patientPackage) {
      console.error(`Package with ID ${id} not found.`);
      throw new ErrorMessage(404, "Package not found");
    }

    console.log("Package fetched successfully:", patientPackage);
    return successResponse("Package fetched successfully", patientPackage);
  } catch (error) {
    console.error("Error fetching package:", error);
    return errorResponse(error);
  }
};
