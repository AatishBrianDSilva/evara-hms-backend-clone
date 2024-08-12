import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { PurchaseOrder } from "@evara-backend/core/models/pharmacyDashboard/PurchaseOrder";
import Branch from "@evara-backend/core/models/mastersDashboard/global/ClinicBranches";
import mongoose from "mongoose";
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    // Log incoming request data
    console.log("Incoming event:", JSON.stringify(event, null, 2));

    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, "Unauthorized");
    }

    await connectMongoDb();

    if (event.body == null) {
      throw new ErrorMessage(400, "Data is required");
    }

    const data = JSON.parse(event.body);
    console.log("Parsed data:", JSON.stringify(data, null, 2));

    data.branchId = auth.branchId;
    data.clinicId = auth.clinicId;

    const branch = await Branch.findOne({
      code: data.branchId,
      clinicId: data.clinicId,
    }).lean();

    if (!branch) {
      throw new ErrorMessage(404, "Branch not found");
    }
    console.log("Branch found:", branch);

    data.branch = new mongoose.Types.ObjectId(branch._id);
    data.createdBy = auth.userId; // Assuming you have userId in auth

    // Ensure the newAddress field is correctly added if isDifferentAddress is true
    if (data.newAddress) {
      data.newAddress = {
        branchName: data.newAddress.branchName,
        street: data.newAddress.street,
        city: data.newAddress.city,
        state: data.newAddress.state,
        zip: data.newAddress.zip,
      };
      console.log("New Address added:", JSON.stringify(data.newAddress, null, 2));
    } else {
      // Ensure the newAddress is not included if isDifferentAddress is false
      delete data.newAddress;
    }

    const purchaseOrder = new PurchaseOrder(data);
    console.info("Purchase Order to be saved:", JSON.stringify(purchaseOrder, null, 2));

    await purchaseOrder.save();
    console.info("Purchase Order saved successfully");

    return successResponse("Purchase Order added successfully");
  } catch (error) {
    console.error("Error:", error);
    return errorResponse(error);
  }
};
