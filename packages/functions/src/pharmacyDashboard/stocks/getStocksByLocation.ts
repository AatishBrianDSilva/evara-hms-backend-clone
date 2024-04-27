import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import {
  IPharmacyStock,
  PharmacyStock,
} from "@evara-backend/core/src/models/pharmacyDashboard/PharmacyStock";
import { DrugItem } from "@evara-backend/core/src/models/pharmacyDashboard/DrugItem";
import { DrugCategory } from "@evara-backend/core/src/models/pharmacyDashboard/DrugCategory";
import { DrugType } from "@evara-backend/core/src/models/pharmacyDashboard/DrugType";
import { FlattenMaps } from "mongoose";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";

// Handler function
export const fetchStockByLocation: APIGatewayProxyHandler = async (
  event,
  _context
) => {
  try {
    await connectMongoDb();

    if (event.pathParameters === null) {
      throw new ErrorMessage(400, "Path parameters are null");
    }

    // Safely access the id property
    const id = event.pathParameters["id"];
    if (!id) {
      throw new ErrorMessage(400, "Id is not provided");
    }

    const populate = [
      {
        path: "item",
        model: DrugItem.modelName,
        populate: [
          {
            path: "category",
            model: DrugCategory.modelName,
          },
          {
            path: "type",
            model: DrugType.modelName,
          },
        ],
      },
    ];

    // Query stocks based on the specified location ID within batches
    const data = await PharmacyStock.find({
      "batches.locations.location": id,
    }).populate(populate);

    const formattedRecords = formatRecordsForLocation(data, id);

    return successResponse("Success", formattedRecords);
  } catch (error) {
    return errorResponse(error);
  }
};

const formatRecordsForLocation = (
  records: IPharmacyStock[],
  locationId: string
) => {
  return records.map((record) => {
    const recordJSON: FlattenMaps<IPharmacyStock> = record.toJSON();
    const details: { batch: string; quantity: number }[] = [];

    recordJSON.batches.forEach((batch) => {
      const locationData = batch.locations.find(
        (loc) => loc.location.toString() === locationId
      );
      if (locationData) {
        details.push({
          batch: batch.batchNo,
          quantity: locationData.quantity,
        });
      }
    });

    return {
      ...recordJSON,
      details,
    };
  });
};
