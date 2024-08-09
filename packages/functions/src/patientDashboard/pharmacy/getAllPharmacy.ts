import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { log } from "console";
import { PatientPharmacy } from "@evara-backend/core/src/models/patientDashboard/PatientPharmacy";
import Patient from "@evara-backend/core/models/Patients";
import Doctors from "@evara-backend/core/src/models/mastersDashboard/Doctors";
import { PharmacyStock } from "@evara-backend/core/src/models/pharmacyDashboard/PharmacyStock";
import { DrugLocation } from "@evara-backend/core/src/models/pharmacyDashboard/DrugLocation";
import { DrugItem } from "@evara-backend/core/src/models/pharmacyDashboard/DrugItem";
import { DrugCategory } from "@evara-backend/core/src/models/pharmacyDashboard/DrugCategory";
import { DrugType } from "@evara-backend/core/src/models/pharmacyDashboard/DrugType";
import { DrugVendor } from "@evara-backend/core/src/models/pharmacyDashboard/DrugVendor";
import { extractAuthorizerDetails } from "@evara-backend/core/lib/utils/extractAuthorizerDetails";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;
  const auth = extractAuthorizerDetails(event);

  try {
    // Connect to MongoDB
    await connectMongoDb();

    // Define population paths for related models
    const populatePaths = [
      {
        path: "item.stock",
        model: PharmacyStock.modelName,
        populate: [
          {
            path: "item",
            model: DrugItem.modelName,
            populate: [
              { path: "category", model: DrugCategory.modelName },
              { path: "type", model: DrugType.modelName },
            ],
          },
          { path: "batches.locations.location", model: DrugLocation.modelName },
          { path: "batches.vendor", model: DrugVendor.modelName },
          { path: "batches.vendor.location", model: DrugLocation.modelName },
        ],
      },
      { path: "doctor", model: Doctors.modelName },
      { path: "item.details.location", model: DrugLocation.modelName },
    ];

    // Fetch all records from PatientPharmacy and convert them to plain objects with populated fields
    const pharmacyData = await PatientPharmacy.find({
      clinicId: auth.clinicId,
      branchId: auth.branchId,
    })
      .populate(populatePaths)
      .lean();

    // Extract unique patient IDs
    const patientIds = Array.from(
      new Set(
        pharmacyData
          .map((record) => {
            // log("Current Record Patient Field:", record.patient);
            return record.patient;
          })
          .filter((id) => id !== undefined && id !== null)
      )
    );

    // log("Extracted Patient IDs:", patientIds);

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
      {}
    );

    // Combine patient details with pharmacy records
    const combinedData = pharmacyData.map((record) => {
      const patientDetails = patientMap[record.patient] || {};

      // Calculate total quantity from all details in item.details
      const totalQuantity = record.item.details.reduce((sum, detail) => {
        return sum + (detail.quantity || 0);
      }, 0);

      return {
        ...record,
        id: record._id, // Ensure unique `id` for each row
        totalQuantity, // Include the calculated totalQuantity
        patientDetails: {
          fullName: `${patientDetails.firstName || ""} ${
            patientDetails.lastName || ""
          }`.trim(),
          ...patientDetails,
        },
      };
    });

    // log("Combined Data with Total Quantity:", JSON.stringify(combinedData, null, 2));

    return successResponse("Success", {
      records: combinedData,
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    return errorResponse(error);
  }
};
