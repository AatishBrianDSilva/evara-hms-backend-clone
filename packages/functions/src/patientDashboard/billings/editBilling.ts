import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import {
  PatientBilling,
  IPatientBilling,
} from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling";
import { S3KeepPermanently, parseS3Url } from "src/files/_KeepPermanently";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb();

    if (!event.pathParameters) {
      throw new ErrorMessage(400, "Path parameters are null");
    }

    const id = event.pathParameters["id"];
    if (!id) {
      throw new ErrorMessage(400, "Id is not provided");
    }

    if (!event.body) {
      throw new ErrorMessage(400, "Data is required");
    }

    const {
      updates,
    }: {
      updates: Partial<
        Pick<IPatientBilling, "discount" | "discountReason" | "discountFile" | "discountType">
      >;
    } = JSON.parse(event.body);

    console.log("Updates", updates);

    const updateKeys = Object.keys(updates);
    const allowedUpdates = ["discount", "discountReason", "discountFile", "discountType"];
    const isValidUpdate = updateKeys.every((key) => allowedUpdates.includes(key));

    if (!isValidUpdate) {
      throw new ErrorMessage(
        4000,
        "Invalid update fields. Only 'discount', 'discountReason', 'discountFile', 'discountType' can be updated."
      );
    }

    const discountType = updates.discountType;
    const discountValue = updates.discount;
    let discountInAmount = 0;
    let discountInPercentage = 0;

    const billing = await PatientBilling.findById(id);
    if (!billing) {
      throw new ErrorMessage(404, "Billing document not found");
    }

    if (discountType === "percentage") {
      discountInPercentage = discountValue;
      discountInAmount = billing.subTotal * (discountInPercentage / 100);
    } else if (discountType === "amount") {
      discountInAmount = discountValue;
      discountInPercentage = (discountInAmount / billing.subTotal) * 100;
    }

    // Round the values to the nearest whole number
    discountInAmount = Math.round(discountInAmount);
    discountInPercentage = Math.round(discountInPercentage);

    const updatedBilling = await PatientBilling.findByIdAndUpdate(
      id,
      {
        $set: {
          discountReason: updates.discountReason,
          discount: discountInAmount,
          discountInPercentage: discountInPercentage,
          discountFile: updates.discountFile,
        },
      },
      { new: true, runValidators: true }
    );

    if (!updatedBilling) {
      throw new ErrorMessage(404, "Failed to update billing document");
    }

    if (updates.discountFile && updates.discountFile.startsWith("https://")) {
      const s3UrlParts = parseS3Url(updates.discountFile);
      if (s3UrlParts) {
        await S3KeepPermanently(s3UrlParts.bucketName, s3UrlParts.key);
      }
    }

    return successResponse("Billing updated successfully", {
      updatedBilling,
    });
  } catch (error) {
    console.error("Error updating billing:", error);
    return errorResponse(error);
  }
};
