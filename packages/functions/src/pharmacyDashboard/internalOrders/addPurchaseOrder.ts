import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import errorMessage from "@evara-backend/core/lib/utils/errorMessage";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/lib/utils/successResponse";
import { PurchaseOrder } from "@evara-backend/core/models/pharmacyDashboard/PurchaseOrder";
import Branch from "@evara-backend/core/models/ClinicBranches";
import mongoose from "mongoose";
import { log } from "console";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();

    if (event.body == null) {
      throw new errorMessage(400, "Data is required");
    }

    const data = JSON.parse(event.body);
    data.branchId = "KL";

    const branch = await Branch.findOne({ code: data.branchId }).lean();
    log("Branch", branch);
    // if (!branch) {
    //   throw new errorMessage(404, "Branch not found");
    // }

    data.branch = new mongoose.Types.ObjectId(branch?._id);
    data.createdBy = "User 1";
    data.response = null;

    const purchaseOrder = new PurchaseOrder(data);
    console.info("Purchase Order", purchaseOrder);
    await purchaseOrder.save();

    return successResponse("Purchase Order added successfully");
  } catch (error) {
    return errorResponse(error);
  }
};
