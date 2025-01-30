import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import formatPaginationResult from '@evara-backend/core/src/lib/utils/formatPaginationResult';
import { IPaginateOptions } from '@evara-backend/core/src/lib/types/pagination';
import { DrugVendor } from '@evara-backend/core/src/models/pharmacyDashboard/DrugVendor';
import { DrugItem } from '@evara-backend/core/src/models/pharmacyDashboard/DrugItem';
import { DrugLocation } from '@evara-backend/core/src/models/pharmacyDashboard/DrugLocation';
import { log } from 'console';
import { PharmacyStock } from '@evara-backend/core/src/models/pharmacyDashboard/PharmacyStock';
import { DrugCategory } from '@evara-backend/core/src/models/pharmacyDashboard/DrugCategory';
import { DrugType } from '@evara-backend/core/src/models/pharmacyDashboard/DrugType';
import { extractAuthorizerDetails } from '@evara-backend/core/src/lib/utils/extractAuthorizerDetails';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';

// Utility function to parse the combined search query
const parseSearchQuery = (query: string) => {
  const searchTermMatch = query.match(/searchTerm:(.*?)(\s|$)/);
  const locationMatch = query.match(/location:(.*?)(\s|$)/);

  return {
    searchTerm: searchTermMatch ? searchTermMatch[1] : '',
    locationQuery: locationMatch ? locationMatch[1] : '',
  };
};

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, 'Unauthorized');
    }

    await connectMongoDb();

    const params = event.queryStringParameters || {};
    const {
      page = '1',
      limit = '10',
      sort: sortRaw,
      status,
      searchQuery = '', // The combined search query
    } = params;

    const sort = sortRaw ? JSON.parse(sortRaw) : { 'item.name': 1 };

    // Parse the combined search query
    const { searchTerm, locationQuery } = parseSearchQuery(searchQuery);

    const query: any = {
      clinicId: auth.clinicId,
      branchId: auth.branchId,
      'batches.locations.quantity': { $gt: 0 }, // Exclude items with 0 quantity
    };

    if (searchTerm) {
      query['item.name'] = { $regex: searchTerm, $options: 'i' };
    }

    const populate = [
      {
        path: 'item',
        model: DrugItem.modelName,
        populate: [
          {
            path: 'category',
            model: DrugCategory.modelName,
          },
          {
            path: 'type',
            model: DrugType.modelName,
          },
        ],
      },
      {
        path: 'batches.locations.location',
        model: DrugLocation.modelName,
      },
      {
        path: 'batches.vendor',
        model: DrugVendor.modelName,
      },
    ];

    let options: IPaginateOptions;
    if (parseInt(limit, 10) === -1) {
      // Fetch all records if the limit is -1
      log('Fetching all records without pagination.');
      options = {
        populate,
        sort,
        pagination: false, // Disable pagination to get all records
      };
    } else {
      log(`Applying pagination with limit: ${limit}, page: ${page}`);
      options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        populate,
        sort,
      };
    }

    const result = await PharmacyStock.paginate(query, options);

    const { records, pagination } = formatPaginationResult(result);

    // Format the records to include the calculated fields
    const formattedRecords = formatPaginateRecords(records);

    // Handle locationQuery filtering on formatted records
    const filteredRecords = locationQuery
      ? formattedRecords.filter(record =>
          record.locationNames
            .toLowerCase()
            .includes(locationQuery.toLowerCase()),
        )
      : formattedRecords;

    // Update pagination to reflect filtered results if needed
    const updatedPagination = {
      ...pagination,
      totalDocs: filteredRecords.length,
    };

    return successResponse('Success', {
      records: filteredRecords,
      pagination: updatedPagination,
    });
  } catch (error) {
    if (error instanceof ErrorMessage) {
      return errorResponse(error);
    }

    // Log the error for debugging
    console.error('Unexpected error occurred:', error);

    // Return a detailed error response for debugging in non-production environments
    const errorMessage =
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred. Please try again later.'
        : error.message || 'An unknown error occurred';

    return errorResponse(new ErrorMessage(500, errorMessage));
  }
};

// Function to format records with additional fields and exclude zero-quantity batches
const formatPaginateRecords = (records: any[]) =>
  records
    .map(record => {
      // Filter out batches where all locations have quantity 0
      const filteredBatches = record.batches.filter(batch =>
        batch.locations.some(loc => loc.quantity > 0),
      );

      // If no batches left after filtering, exclude this record
      if (filteredBatches.length === 0) {
        return null;
      }

      // Calculate the latest expiry date from the filtered batches
      const latestExpiryDate = filteredBatches.reduce((latest, batch) => {
        const batchDate = new Date(batch.expiryDate);
        return latest > batchDate ? latest : batchDate;
      }, new Date(0)); // Initialize with epoch

      // Aggregate all unique location names from the filtered batches
      const locationNames = filteredBatches.flatMap(batch =>
        batch.locations.map(loc => loc.location.location),
      );

      const uniqueLocations = Array.from(new Set(locationNames));
      const uniqueLocationCount = uniqueLocations.length;
      const uniqueLocationString = uniqueLocations.join(', ');

      // Calculate MRP per item
      const packSize = record.item?.packSize || 1;
      const mrpPerItem = parseFloat((record.sellPrice / packSize).toFixed(2));

      // Calculate total quantity based on filtered batches
      const totalQuantity = filteredBatches.reduce((total, batch) => {
        return (
          total +
          batch.locations.reduce((sum, loc) => {
            return sum + loc.quantity;
          }, 0)
        );
      }, 0);

      return {
        ...record, // Convert Mongoose Document to plain object
        batches: filteredBatches, // Update batches to filtered batches
        latestExpiryDate: latestExpiryDate.toISOString(),
        locations: uniqueLocationCount,
        batchesCount: filteredBatches.length,
        locationNames: uniqueLocationString,
        mrpPerItem,
        totalQuantity, // Update totalQuantity based on filtered data
      };
    })
    .filter(record => record !== null); // Remove records that have no batches after filtering
