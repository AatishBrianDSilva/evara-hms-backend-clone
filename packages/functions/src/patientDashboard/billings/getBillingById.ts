import { APIGatewayProxyHandler } from "aws-lambda";
import mongoose from "mongoose";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";

import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import Doctors from "@evara-backend/core/src/models/mastersDashboard/Doctors";
import { PatientBilling } from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling";
import { PatientPharmacy } from "@evara-backend/core/src/models/patientDashboard/PatientPharmacy";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

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
        path: "items.doctorId",
        model: Doctors.modelName,
      },
    ];

    const billingData = await PatientBilling.findById(id).populate(populate);

    if (!billingData) {
      throw new ErrorMessage(404, "Not found");
    }

    let pharmacyData = [];
    if (billingData.billType === "Pharmacy") {
      // Query PatientPharmacy data using the serviceId from billing items
      const serviceIds = billingData.items.map((item) => item.serviceId);
      pharmacyData = await PatientPharmacy.find({ _id: { $in: serviceIds } });

      // Include the additional fields in the pharmacy data response
      pharmacyData = pharmacyData.map((pharmacy) => ({
        _id: pharmacy._id,
        patient: pharmacy.patient,
        branchId: pharmacy.branchId,
        clinicId: pharmacy.clinicId,
        item: pharmacy.item.details.map((detail) => ({
          _id: detail._id,
          location: detail.location,
          quantity: detail.quantity,
          batchNumber: detail.batchNumber,
          packSize: detail.packSize, // Include packSize
          mrp: detail.mrp, // Include MRP
          expiryDate: detail.expiryDate, // Include expiryDate
          vendor: detail.vendor, // Include vendor
          itemId: detail.itemId,
        })),
        doctor: pharmacy.doctor,
        date: pharmacy.date,
        allocatedBy: pharmacy.allocatedBy,
        totalQuantity: pharmacy.totalQuantity,
        patientData: pharmacy.patientData,
      }));
    }

    const response = {
      ...billingData.toObject(),
      pharmacyData: pharmacyData,
    };

    console.log("Bill fetched", response);

    return successResponse("Fetched successfully", response);
  } catch (error) {
    return errorResponse(error);
  }
};
