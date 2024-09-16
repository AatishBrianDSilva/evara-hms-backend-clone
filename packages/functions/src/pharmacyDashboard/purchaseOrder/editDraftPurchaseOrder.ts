import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { PurchaseOrder } from "@evara-backend/core/models/pharmacyDashboard/PurchaseOrder";
import Branch from "@evara-backend/core/models/mastersDashboard/global/ClinicBranches";
import mongoose from "mongoose";
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";
import { processPurchaseOrderReportData } from "./processPurchaseOrderReportData";
import SNSService from "@evara-backend/core/lib/aws/sns";
import { DrugVendor } from "@evara-backend/core/models/pharmacyDashboard/DrugVendor";
import { DrugItem } from "@evara-backend/core/models/pharmacyDashboard/DrugItem";

// Handler function to edit a draft purchase order
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    // Log incoming request data
    console.log("Incoming event:", JSON.stringify(event, null, 2));

    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, "Unauthorized");
    }

    console.log("Auth data", auth);

    await connectMongoDb();

    if (!event.body) {
      throw new ErrorMessage(400, "Data is required");
    }

    const data = JSON.parse(event.body);
    console.log("Parsed data:", JSON.stringify(data, null, 2));

    const { id } = data;
    if (!id) {
      throw new ErrorMessage(400, "Purchase order ID is required");
    }

    data.branchId = auth.branchId;
    data.clinicId = auth.clinicId;

    // Fetch the existing purchase order (draft)
    const purchaseOrder = await PurchaseOrder.findById(id);
    if (!purchaseOrder) {
      throw new ErrorMessage(404, "Purchase order not found");
    }

    // Only allow editing of draft purchase orders
    if (purchaseOrder.status !== "Draft") {
      throw new ErrorMessage(400, "Only draft purchase orders can be edited");
    }

    // Fetch the branch details
    const branch = await Branch.findOne({
      code: data.branchId,
      clinicId: data.clinicId,
    }).lean();

    if (!branch) {
      throw new ErrorMessage(404, "Branch not found");
    }
    console.log("Branch found:", branch);

    // Fetch the vendor details using the vendor ID
    const vendorDetails = await DrugVendor.findById(data.vendor).lean();
    if (!vendorDetails) {
      throw new ErrorMessage(404, "Vendor not found");
    }
    console.log("Vendor details:", vendorDetails);

    data.branch = new mongoose.Types.ObjectId(branch._id);
    data.updatedBy = auth.userId; // Assuming userId from auth for updating

    // Fetch item details from DrugItem for each item in the purchase order
    const updatedItems = await Promise.all(
      data.request.items.map(async (item: any) => {
        const drugItem = await DrugItem.findById(item.item).lean();
        if (!drugItem) {
          throw new ErrorMessage(404, `Drug item not found for ID: ${item.item}`);
        }

        // Add name, cost, and discount to the item details
        return {
          ...item,
          name: drugItem.name,
          amount: drugItem.rate,
        };
      })
    );

    // Handle address updates
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
      delete data.newAddress; // Remove if not different
    }

    // Update the purchase order with new data
    Object.assign(purchaseOrder, data);

    console.info("Purchase Order to be updated:", JSON.stringify(purchaseOrder, null, 2));

    await purchaseOrder.save();
    console.info("Draft Purchase Order updated successfully");

    // Generate report data after saving the updated draft PO
    const reportData = processPurchaseOrderReportData(
      purchaseOrder,
      auth.clinicId,
      branch,
      vendorDetails,
      updatedItems
    );

    // Send the report data to SNS for report generation
    await SNSService.publishMessage({
      Message: JSON.stringify(reportData),
      TopicArn: process.env.REPORT_HTML_GENERATION_TOPIC_ARN, // ARN for report generation
    });

    console.info("Report generation triggered successfully", reportData);

    return successResponse("Draft Purchase Order updated successfully");
  } catch (error) {
    console.error("Error editing draft purchase order:", error);
    return errorResponse(error);
  }
};
