import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "../../../core/src/lib/utils/errorResponse";
import successResponse from "../../../core/src/lib/utils/successResponse";
import MasterInvestigation from "../../../core/src/models/MasterInvestigations";
import MedicalTest from "../../../core/src/models/MedicalTests"; // Ensure this import path matches your project structure
import { connectMongoDb } from "../../../core/src/lib/db/mongodb";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    // Connect to MongoDB
    await connectMongoDb();

    // Fetch all medical tests
    const medicalTests = await MedicalTest.find();

    // Create a Master Investigation for each medical test
    const investigations = await Promise.all(
      medicalTests.map(async (test) => {
        const investigation = new MasterInvestigation({
          test: test._id, // Assuming the _id field of the MedicalTest is what's needed here
          name: test.testName,
          description: test.description, // Assuming you want to copy the description from the MedicalTest
          cost: Math.floor(Math.random() * (2000 - 200) + 200), // Random cost between 200 and 2000
          active: true,
        });

        return await investigation.save();
      })
    );

    // Return success response with all created investigations
    return successResponse(
      `${investigations.length} Investigations created successfully`,
      investigations
    );
  } catch (error) {
    // Handle any errors that occur during the operation
    return errorResponse(error);
  }
};
