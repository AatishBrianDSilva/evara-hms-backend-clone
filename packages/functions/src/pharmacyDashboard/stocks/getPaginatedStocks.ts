import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import formatPaginationResult from "@evara-backend/core/src/lib/utils/formatPaginationResult";
import { IPaginateOptions } from "@evara-backend/core/src/lib/types/pagination";
import { DrugVendor } from "@evara-backend/core/src/models/pharmacyDashboard/DrugVendor";
import { DrugItem } from "@evara-backend/core/src/models/pharmacyDashboard/DrugItem";
import { DrugLocation } from "@evara-backend/core/src/models/pharmacyDashboard/DrugLocation";
import { log } from "console";
import { PharmacyStock } from "@evara-backend/core/src/models/pharmacyDashboard/PharmacyStock";
import { DrugCategory } from "@evara-backend/core/src/models/pharmacyDashboard/DrugCategory";
import { DrugType } from "@evara-backend/core/src/models/pharmacyDashboard/DrugType";
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";

// Utility function to parse the combined search query
const parseSearchQuery = (query) => {
  const searchTermMatch = query.match(/searchTerm:(.*?)(\s|$)/);
  const locationMatch = query.match(/location:(.*?)(\s|$)/);

  return {
    searchTerm: searchTermMatch ? searchTermMatch[1] : "",
    locationQuery: locationMatch ? locationMatch[1] : "",
  };
};

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
      searchQuery = "", // The combined search query
    } = params;

    const sort = sortRaw ? JSON.parse(sortRaw) : undefined;

    // Parse the combined search query
    const { searchTerm, locationQuery } = parseSearchQuery(searchQuery);

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

    // Handle searchTerm filtering by drug name
    if (searchTerm) {
      const itemIds = await DrugItem.find({
        name: { $regex: searchTerm, $options: "i" },
      })
        .select("_id")
        .exec();

      const ids = itemIds.map((item) => item._id);
      query.item = { $in: ids };
    }

    const options: IPaginateOptions = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      populate,
      sort,
    };

    const result = await PharmacyStock.paginate(query, options);

    const { records, pagination } = formatPaginationResult(result);

    // Format the records to include the calculated fields
    const formattedRecords = formatPaginateRecords(records);

    // Handle locationQuery filtering on formatted records
    const filteredRecords = locationQuery
      ? formattedRecords.filter((record) =>
          record.locationNames.toLowerCase().includes(locationQuery.toLowerCase())
        )
      : formattedRecords;

    // Update pagination to reflect filtered results if needed
    const updatedPagination = {
      ...pagination,
      totalDocs: filteredRecords.length,
    };

    return successResponse("Success", {
      records: filteredRecords,
      pagination: updatedPagination,
    });
  } catch (error) {
    return errorResponse(error);
  }
};

// Function to format records with additional fields
const formatPaginateRecords = (records) =>
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

    const uniqueLocations = Array.from(new Set(locationNames)); // Convert Set to Array to get unique values

    const uniqueLocationCount = uniqueLocations.length; // Count of unique locations

    const uniqueLocationString = uniqueLocations.join(", "); // Concatenate all unique location names

    // Calculate MRP per item
    const packSize = record.item?.packSize || 1; // Default to 1 if packSize is not defined
    const mrpPerItem = parseFloat((record.sellPrice / packSize).toFixed(2)); // Ensure float value with two decimal precision

    // Return the new record with additional fields
    return {
      ...record,
      latestExpiryDate: latestExpiryDate.toISOString(), // Convert to ISO string or use another format
      locations: uniqueLocationCount,
      batchesCount: record.batches.length,
      locationNames: uniqueLocationString, // New field for concatenated locations
      mrpPerItem, // MRP per individual item
    };
  });

// import { APIGatewayProxyHandler } from "aws-lambda";
// import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
// import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
// import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
// import formatPaginationResult from "@evara-backend/core/src/lib/utils/formatPaginationResult";
// import { IPaginateOptions } from "@evara-backend/core/src/lib/types/pagination";
// import { DrugVendor } from "@evara-backend/core/src/models/pharmacyDashboard/DrugVendor";
// import { DrugItem } from "@evara-backend/core/src/models/pharmacyDashboard/DrugItem";
// import { DrugLocation } from "@evara-backend/core/src/models/pharmacyDashboard/DrugLocation";
// import { log } from "console";
// import { PharmacyStock } from "@evara-backend/core/src/models/pharmacyDashboard/PharmacyStock";
// import { DrugCategory } from "@evara-backend/core/src/models/pharmacyDashboard/DrugCategory";
// import { DrugType } from "@evara-backend/core/src/models/pharmacyDashboard/DrugType";
// import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";
// import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";

// // Utility function to parse the combined search query
// const parseSearchQuery = (query) => {
//   const searchTermMatch = query.match(/searchTerm:(.*?)(\s|$)/);
//   const locationMatch = query.match(/location:(.*?)(\s|$)/);

//   return {
//     searchTerm: searchTermMatch ? searchTermMatch[1] : "",
//     locationQuery: locationMatch ? locationMatch[1] : "",
//   };
// };

// export const main: APIGatewayProxyHandler = async (event, _context) => {
//   _context.callbackWaitsForEmptyEventLoop = false;

//   try {
//     const auth = extractAuthorizerDetails(event);
//     if (!auth) {
//       throw new ErrorMessage(401, "Unauthorized");
//     }

//     await connectMongoDb();

//     const params = event.queryStringParameters || {};
//     const {
//       page = "1",
//       limit = "10",
//       sort: sortRaw,
//       status,
//       searchQuery = "", // The combined search query
//     } = params;

//     const sort = sortRaw ? JSON.parse(sortRaw) : undefined;

//     // Parse the combined search query
//     const { searchTerm, locationQuery } = parseSearchQuery(searchQuery);

//     const populate = [
//       {
//         path: "item",
//         model: DrugItem.modelName,
//         populate: [
//           {
//             path: "category",
//             model: DrugCategory.modelName,
//           },
//           {
//             path: "type",
//             model: DrugType.modelName,
//           },
//         ],
//       },
//       {
//         path: "batches.locations.location",
//         model: DrugLocation.modelName,
//       },
//       {
//         path: "batches.vendor",
//         model: DrugVendor.modelName,
//       },
//       {
//         path: "batches.vendor.location",
//         model: DrugLocation.modelName,
//       },
//     ];

//     const query: any = {};
//     query.branchId = auth.branchId;
//     query.clinicId = auth.clinicId;

//     if (status) {
//       query.status = status;
//     }

//     // Handle searchTerm filtering by drug name
//     if (searchTerm) {
//       const itemIds = await DrugItem.find({
//         name: { $regex: searchTerm, $options: "i" },
//       })
//         .select("_id")
//         .exec();

//       const ids = itemIds.map((item) => item._id);
//       query.item = { $in: ids };
//     }

//     const options: IPaginateOptions = {
//       page: parseInt(page, 10),
//       limit: parseInt(limit, 10),
//       populate,
//       sort,
//     };

//     const result = await PharmacyStock.paginate(query, options);

//     const { records, pagination } = formatPaginationResult(result);

//     // Format the records to include the calculated fields
//     const formattedRecords = formatPaginateRecords(records);

//     // Handle locationQuery filtering on formatted records
//     const filteredRecords = locationQuery
//       ? formattedRecords.filter((record) =>
//           record.locationNames.toLowerCase().includes(locationQuery.toLowerCase())
//         )
//       : formattedRecords;

//     // Update pagination to reflect filtered results if needed
//     const updatedPagination = {
//       ...pagination,
//       totalDocs: filteredRecords.length,
//       totalPages: Math.ceil(filteredRecords.length / limit),
//     };

//     // Paginate the filtered records manually
//     const paginatedRecords = filteredRecords.slice((page - 1) * limit, page * limit);

//     return successResponse("Success", {
//       records: paginatedRecords,
//       pagination: updatedPagination,
//     });
//   } catch (error) {
//     return errorResponse(error);
//   }
// };

// // Function to format records with additional fields
// const formatPaginateRecords = (records) =>
//   records.map((record) => {
//     // Calculate the latest expiry date
//     const latestExpiryDate = record.batches.reduce((latest, batch) => {
//       const batchDate = new Date(batch.expiryDate);
//       return latest > batchDate ? latest : batchDate;
//     }, new Date(0)); // Assumes batches is not empty

//     // Aggregate all locations into a single string
//     const locationNames = record.batches.flatMap((batch) =>
//       batch.locations.map((loc) => loc.location.location)
//     ); // Flatten all location names into one array

//     const uniqueLocations = Array.from(new Set(locationNames)); // Convert Set to Array to get unique values

//     const uniqueLocationCount = uniqueLocations.length; // Count of unique locations

//     const uniqueLocationString = uniqueLocations.join(", "); // Concatenate all unique location names

//     // Calculate MRP per item
//     const packSize = record.item?.packSize || 1; // Default to 1 if packSize is not defined
//     const mrpPerItem = parseFloat((record.sellPrice / packSize).toFixed(2)); // Ensure float value with two decimal precision

//     // Return the new record with additional fields
//     return {
//       ...record,
//       latestExpiryDate: latestExpiryDate.toISOString(), // Convert to ISO string or use another format
//       locations: uniqueLocationCount,
//       batchesCount: record.batches.length,
//       locationNames: uniqueLocationString, // New field for concatenated locations
//       mrpPerItem, // MRP per individual item
//     };
//   });
