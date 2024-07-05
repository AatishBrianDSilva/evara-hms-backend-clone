import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { PurchaseOrder } from "@evara-backend/core/src/models/pharmacyDashboard/PurchaseOrder";
import { PharmacyInvoice } from "@evara-backend/core/models/pharmacyDashboard/PharmacyInvoice";
import { S3KeepPermanently, parseS3Url } from "src/files/_KeepPermanently";

// Handler function for updating a single tax rate
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb(); // Connect to MongoDB

    if (!event.body) {
      throw new ErrorMessage(400, "Data is required");
    }

    // Assuming the event body will contain the ID of the tax rate to be updated and the new values
    const { id, ...updateData } = JSON.parse(event.body);

    if (!id) {
      throw new ErrorMessage(400, "ID is required for update");
    }

    if (
      updateData.response?.invoice &&
      updateData.response?.invoice.length > 0
    ) {
      for (let i = 0; i < updateData.response?.invoice.length; i++) {
        if (updateData.response?.invoice[i].length > 0) {
          const s3UrlParts = parseS3Url(updateData.response?.invoice[i]);

          if (s3UrlParts) {
            await S3KeepPermanently(s3UrlParts.bucketName, s3UrlParts.key);
            console.log("S3 url parts", s3UrlParts);
            const invoicePart = s3UrlParts.key.split("/");

            const po = await PurchaseOrder.findById(id).lean();

            const pharmacyInvoice = new PharmacyInvoice({
              purchaseOrderId: po?.poNumber,
              invoice: invoicePart[invoicePart.length - 1],
              bucket: s3UrlParts.bucketName,
              key: s3UrlParts.key,
            });
            // console.info("Pharmacy Invoice", pharmacyInvoice);
            await pharmacyInvoice.save();
          } else {
            throw new ErrorMessage(400, "Invalid image URL");
          }
        }
      }
    }

    // Find by ID and update the tax rate
    const updatedData = await PurchaseOrder.findByIdAndUpdate(id, updateData, {
      new: true, // Return the updated document
    });

    if (!updatedData) {
      throw new ErrorMessage(404, "Data not found");
    }

    return successResponse("Data updated successfully", updatedData);
  } catch (error) {
    return errorResponse(error);
  }
};
