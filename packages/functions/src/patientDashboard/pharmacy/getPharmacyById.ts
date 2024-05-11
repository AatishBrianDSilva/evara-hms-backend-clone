import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";

import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import { DrugItem } from "@evara-backend/core/src/models/pharmacyDashboard/DrugItem";
import { DrugVendor } from "@evara-backend/core/src/models/pharmacyDashboard/DrugVendor";
import { PharmacyStock } from "@evara-backend/core/src/models/pharmacyDashboard/PharmacyStock";
import { DrugLocation } from "@evara-backend/core/src/models/pharmacyDashboard/DrugLocation";
import { DrugCategory } from "@evara-backend/core/src/models/pharmacyDashboard/DrugCategory";
import { DrugType } from "@evara-backend/core/src/models/pharmacyDashboard/DrugType";
import Doctors from "@evara-backend/core/src/models/mastersDashboard/Doctors";
import { PatientPharmacy } from "@evara-backend/core/src/models/patientDashboard/PatientPharmacy";
import { TaxRate } from "@evara-backend/core/src/models/pharmacyDashboard/TaxRate";

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
        path: "item.stock",
        model: PharmacyStock.modelName,
        populate: [
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
              {
                path: "taxRate",
                model: TaxRate.modelName,
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
        ],
      },
      {
        path: "doctor",
        model: Doctors.modelName,
      },
      {
        path: "item.details.location",
        model: DrugLocation.modelName,
      },
    ];

    const data = await PatientPharmacy.findById(id).populate(populate).lean();

    if (!data) {
      throw new ErrorMessage(404, "Not found");
    }

    return successResponse("Fetched successfully", data);
  } catch (error) {
    return errorResponse(error);
  }
};
