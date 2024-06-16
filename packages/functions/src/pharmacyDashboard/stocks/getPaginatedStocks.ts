import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import formatPaginationResult from "@evara-backend/core/src/lib/utils/formatPaginationResult";
import { IPaginateOptions } from "@evara-backend/core/src/lib/types/pagination";
import { DrugVendor } from "@evara-backend/core/src/models/pharmacyDashboard/DrugVendor";
import { DrugItem } from "@evara-backend/core/src/models/pharmacyDashboard/DrugItem";
import { log } from "console";
import { DrugLocation } from "@evara-backend/core/src/models/pharmacyDashboard/DrugLocation";
import {
  IBatchDetails,
  IPharmacyStock,
  PharmacyStock,
} from "@evara-backend/core/src/models/pharmacyDashboard/PharmacyStock";
import { DrugCategory } from "@evara-backend/core/src/models/pharmacyDashboard/DrugCategory";
import { DrugType } from "@evara-backend/core/src/models/pharmacyDashboard/DrugType";
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
    const {
      page = "1",
      limit = "10",
      sort: sortRaw,
      status,
      searchQuery = "",
    } = params;

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

    const options: IPaginateOptions = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    };

    if (sort) {
      options.sort = sort;
    }

    options.populate = populate;

    if (searchQuery) {
      const itemIds = await DrugItem.find({
        name: { $regex: searchQuery, $options: "i" },
      })
        .select("_id")
        .exec();

      // Map to extract only the _id values
      const ids = itemIds.map((item) => item._id);

      // Use these IDs to adjust the PharmacyStock query
      query.item = { $in: ids };

      log("Search Query", query);

      // Fetch the PharmacyStock records with pagination using the modified query
      const result = await PharmacyStock.paginate(query, options);
      const { records, pagination } = formatPaginationResult(result);

      const formattedRecords = formatPaginateRecords(records);

      return successResponse("Success", {
        records: formattedRecords,
        pagination,
      });
    } else {
      console.log("No Search Query", query);

      const result = await PharmacyStock.paginate(query, options);

      const { records, pagination } = formatPaginationResult(result);

      const formattedRecords = formatPaginateRecords(records);

      return successResponse("Success", {
        records: formattedRecords,
        pagination,
      });
    }
  } catch (error) {
    return errorResponse(error);
  }
};

const formatPaginateRecords = (records: IPharmacyStock[]) =>
  records.map((record) => {
    // Calculate the latest expiry date
    const latestExpiryDate = record.batches.reduce((latest, batch) => {
      const batchDate = new Date(batch.expiryDate);
      return latest > batchDate ? latest : batchDate;
    }, new Date(0)); // Assumes batches is not empty

    // Aggregate all locations into a single string
    const locationNames = record.batches.flatMap((batch) =>
      batch.locations.map((loc) => loc.location.location)
    ); // Flatten all location names into one array

    const uniqueLocations = new Set(locationNames); // Use a Set to keep only unique values

    const uniqueLocationCount = uniqueLocations.size; // Count of unique locations

    // Return the new record with additional fields
    return {
      ...record,
      latestExpiryDate: latestExpiryDate, // Convert to ISO string or use another format
      locations: uniqueLocationCount,
      batchesCount: record.batches.length,
    };
  });
