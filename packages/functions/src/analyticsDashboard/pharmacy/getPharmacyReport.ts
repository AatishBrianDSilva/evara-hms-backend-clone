import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import formatPaginationResult from '@evara-backend/core/src/lib/utils/formatPaginationResult';
import { PatientPharmacy } from '@evara-backend/core/src/models/patientDashboard/PatientPharmacy';
import Patient from '@evara-backend/core/models/Patients';
import Doctors from '@evara-backend/core/src/models/mastersDashboard/Doctors';
import { PharmacyStock } from '@evara-backend/core/src/models/pharmacyDashboard/PharmacyStock';
import { DrugLocation } from '@evara-backend/core/src/models/pharmacyDashboard/DrugLocation';
import { DrugItem } from '@evara-backend/core/src/models/pharmacyDashboard/DrugItem';
import { DrugCategory } from '@evara-backend/core/src/models/pharmacyDashboard/DrugCategory';
import { DrugType } from '@evara-backend/core/src/models/pharmacyDashboard/DrugType';
import { DrugVendor } from '@evara-backend/core/src/models/pharmacyDashboard/DrugVendor';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import ErrorMessage from '@evara-backend/core/lib/utils/ErrorMessage';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, 'Unauthorized');
    }

    // Connect to MongoDB
    await connectMongoDb();

    // Extract query string parameters for pagination and filtering
    const params = event.queryStringParameters || {};
    const {
      page = '1',
      limit = '25',
      paginate = 'true',
      saleStartDate,
      saleEndDate,
    } = params;

    const isPaginationEnabled = paginate === 'true';
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    console.log('Backend params', params);

    // Define population paths for related models
    const populatePaths = [
      {
        path: 'item.stock',
        model: PharmacyStock.modelName,
        populate: [
          {
            path: 'item',
            model: DrugItem.modelName,
            populate: [
              { path: 'category', model: DrugCategory.modelName },
              { path: 'type', model: DrugType.modelName },
            ],
          },
          { path: 'batches.locations.location', model: DrugLocation.modelName },
          { path: 'batches.vendor', model: DrugVendor.modelName },
          { path: 'batches.vendor.location', model: DrugLocation.modelName },
        ],
      },
      { path: 'doctor', model: Doctors.modelName },
      { path: 'item.details.location', model: DrugLocation.modelName },
    ];

    // Build the query object for filtering by date range (ignoring the time part)
    const query: any = {
      clinicId: auth.clinicId,
      branchId: auth.branchId,
    };

    if (saleStartDate || saleEndDate) {
      const startDate = saleStartDate ? new Date(saleStartDate) : null;
      const endDate = saleEndDate ? new Date(saleEndDate) : null;

      query.createdAt = {
        ...(startDate && { $gte: new Date(startDate.setHours(0, 0, 0, 0)) }), // Start of the day
        ...(endDate && { $lte: new Date(endDate.setHours(23, 59, 59, 999)) }), // End of the day
      };
    }

    // Fetch total number of records for pagination
    const totalRecords = await PatientPharmacy.countDocuments(query);

    // Fetch paginated records from PatientPharmacy
    const pharmacyData = await PatientPharmacy.find(query)
      .populate(populatePaths)
      .skip(isPaginationEnabled ? skip : 0)
      .limit(isPaginationEnabled ? limitNumber : 0)
      .lean();

    // Extract unique patient IDs
    const patientIds = Array.from(
      new Set(
        pharmacyData
          .map(record => record.patient)
          .filter(id => id !== undefined && id !== null),
      ),
    );

    // Fetch patient details using the extracted patient IDs
    const patientData = await Patient.find({
      patientId: { $in: patientIds },
    }).lean();

    // Map patients to a dictionary for easy lookup
    const patientMap: Record<string, any> = patientData.reduce(
      (map, patient) => {
        map[patient.patientId] = patient;
        return map;
      },
      {},
    );

    // Combine patient details with pharmacy records
    const combinedData = pharmacyData.map(record => {
      const patientDetails = patientMap[record.patient] || {};

      // Calculate total quantity from all details in item.details
      const totalQuantity = record.item.details.reduce((sum, detail) => {
        return sum + (detail.quantity || 0);
      }, 0);

      // Calculate total item price (sum of mrp * quantity for all details)
      const totalItemPrice =
        record.item.details.reduce((sum, detail) => {
          const packSize = detail.packSize || 1; // Default to 1 if packSize is not available
          const itemPrice = (detail.mrp / packSize) * (detail.quantity || 0);
          return sum + itemPrice;
        }, 0) || null; // Set to null if no details are present

      return {
        ...record,
        id: record._id, // Ensure unique `id` for each row
        totalQuantity, // Include the calculated totalQuantity
        totalItemPrice, // Include the calculated totalItemPrice
        patientDetails: {
          fullName:
            `${patientDetails.firstName || ''} ${patientDetails.lastName || ''}`.trim(),
          ...patientDetails,
        },
      };
    });

    // Calculate total pages
    const totalPages = isPaginationEnabled
      ? Math.ceil(totalRecords / limitNumber)
      : 1;

    // Format the response with pagination details
    const pagination = {
      totalDocs: totalRecords,
      totalPages,
      currentPage: pageNumber,
      nextPage: pageNumber < totalPages ? pageNumber + 1 : null,
      prevPage: pageNumber > 1 ? pageNumber - 1 : null,
      limit: limitNumber,
    };

    // Combine data and pagination into the final response structure
    const result = {
      records: combinedData,
      pagination,
    };

    return successResponse('Success', result);
  } catch (error) {
    console.error('Error fetching data:', error);
    return errorResponse(error);
  }
};
