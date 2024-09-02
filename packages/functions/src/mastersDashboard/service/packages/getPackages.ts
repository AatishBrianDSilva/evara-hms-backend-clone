import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import MasterPackage from "@evara-backend/core/src/models/patientDashboard/packages/MasterPackage";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import { extractAuthorizerDetails } from "@evara-backend/core/lib/utils/extractAuthorizerDetails";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  console.log("Received event:", JSON.stringify(event, null, 2));

  const auth = extractAuthorizerDetails(event);
  console.log("Extracted auth details:", auth);

  try {
    // Connect to MongoDB
    console.log("Connecting to MongoDB...");
    await connectMongoDb();
    console.log("Connected to MongoDB");

    const params = event.queryStringParameters || {};
    console.log("Query string parameters:", params);

    const { searchQuery = "", active } = params;
    console.log("Search query:", searchQuery);

    let query: any = {
      clinicId: auth.clinicId,
    };

    if (typeof active !== "undefined") {
      query.active = active === "true";
    }

    if (searchQuery) {
      query.$or = [{ name: new RegExp(searchQuery, "i") }];
      console.log("Updated query with search criteria:", query);
    }

    console.log("Fetching packages with query:", query);
    const packages = await MasterPackage.find(query).sort({ name: 1 }).lean();
    console.log("Fetched packages:", packages);

    console.log("Returning success response.");
    return successResponse("Success", packages);
  } catch (error) {
    console.log("Error occurred during package retrieval:", error);
    return errorResponse(error);
  }
};
