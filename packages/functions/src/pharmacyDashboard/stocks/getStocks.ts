import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";

import { DrugVendor } from "@evara-backend/core/src/models/pharmacyDashboard/DrugVendor";
import { DrugItem } from "@evara-backend/core/src/models/pharmacyDashboard/DrugItem";
import { DrugLocation } from "@evara-backend/core/src/models/pharmacyDashboard/DrugLocation";
import {
  IBatchDetails,
  IPharmacyStock,
  PharmacyStock,
} from "@evara-backend/core/src/models/pharmacyDashboard/PharmacyStock";
import { DrugCategory } from "@evara-backend/core/src/models/pharmacyDashboard/DrugCategory";
import { DrugType } from "@evara-backend/core/src/models/pharmacyDashboard/DrugType";
import { FlattenMaps } from "mongoose";
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, "Unauthorized");
    }

    await connectMongoDb();

    const params = event.queryStringParameters || {};
    console.log("Params", params);
    const { sort: sortRaw, status } = params;

    const sort = sortRaw ? JSON.parse(sortRaw) : undefined;

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
      {
        path: "batches.locations.location",
        model: DrugLocation.modelName,
      },
      {
        path: "batches.vendor",
        model: DrugVendor.modelName,
      },
      {
        path: "batches.vendor.location",
        model: DrugLocation.modelName,
      },
    ];

    const query: any = {};
    query.branchId = auth.branchId;
    query.clinicId = auth.clinicId;

    if (status) {
      query.status = status;
    }

    const data = await PharmacyStock.find(query).populate(populate).sort(sort);

    const sortedData = data.sort((a: any, b: any) => {
      return a.item?.name.localeCompare(b.item?.name);
    });

    const formattedRecords = formatRecords(sortedData);
    // console.log(
    //   "Formatted Records",
    //   JSON.stringify(formattedRecords, null, 2)
    // );
    return successResponse("Success", formattedRecords);
  } catch (error) {
    return errorResponse(error);
  }
};

const formatRecords = (records: IPharmacyStock[]) => {
  return records.map((record) => {
    const recordJSON: any = record.toJSON();

    const locationQuantities: any = {};

    recordJSON.batches.forEach((batch: any) => {
      batch.locations.forEach((loc: any) => {
        let locationId = loc.location?._id.toString();

        if (!locationQuantities[locationId]) {
          locationQuantities[locationId] = {
            location: loc.location,
            quantity: 0,
            batches: [],
          };
        }

        if (loc.quantity > 0) {
          locationQuantities[locationId].batches.push({
            batchNo: batch.batchNo,
            quantity: loc.quantity,
          });
        }

        locationQuantities[locationId].quantity += loc.quantity;
      });
    });

    return {
      _id: recordJSON._id,
      item: {
        _id: recordJSON.item?._id,
        name: recordJSON.item?.name,
        category: recordJSON.item?.category?.name,
        type: recordJSON.item?.type?.name,
        packSize: recordJSON.item?.packSize,
      },
      sellPrice: recordJSON.sellPrice,
      totalQuantity: recordJSON.totalQuantity!,
      locations: Object.values(locationQuantities),
    };
  });
};
