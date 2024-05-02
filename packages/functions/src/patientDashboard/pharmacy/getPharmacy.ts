import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import formatPaginationResult from "@evara-backend/core/src/lib/utils/formatPaginationResult";
import { IPaginateOptions } from "@evara-backend/core/src/lib/types/pagination";
import { log } from "console";
import Doctors from "@evara-backend/core/src/models/Doctors";
import { PharmacyStock } from "@evara-backend/core/src/models/pharmacyDashboard/PharmacyStock";
import { DrugLocation } from "@evara-backend/core/src/models/pharmacyDashboard/DrugLocation";
import { DrugItem } from "@evara-backend/core/src/models/pharmacyDashboard/DrugItem";
import { DrugCategory } from "@evara-backend/core/src/models/pharmacyDashboard/DrugCategory";
import { DrugType } from "@evara-backend/core/src/models/pharmacyDashboard/DrugType";
import { DrugVendor } from "@evara-backend/core/src/models/pharmacyDashboard/DrugVendor";
import { PatientPharmacy } from "@evara-backend/core/src/models/patientDashboard/PatientPharmacy";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();

    // Extract patientCode from the query parameters
    if (event.pathParameters === null) {
      throw new ErrorMessage(400, "Path parameters are null");
    }

    // Safely access the id property
    const id = event.pathParameters["patientId"];
    if (!id) {
      throw new ErrorMessage(400, "Id is not provided");
    }

    const params = event.queryStringParameters || {};
    const { page = "1", limit = "10", sort: sortRaw, status } = params;

    const sort = sortRaw ? JSON.parse(sortRaw) : undefined;

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

    const paginate = JSON.parse(params.paginate || "false");

    if (paginate) {
      const options: IPaginateOptions = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      };

      const query: any = {};
      // query.branchId = "KL";

      if (status) {
        query.status = status;
      }

      if (sort) {
        options.sort = sort;
      }

      options.populate = populate;

      query.patient = id;

      log("Patient Pharmacy Query", query);

      // Fetching the appointments with pagination
      const result = await PatientPharmacy.paginate(query, options);
      console.log("Results", JSON.stringify(result, null, 2));
      const { records, pagination } = formatPaginationResult(result);

      return successResponse("Success", {
        records,
        pagination,
      });
    } else {
      const data = await PatientPharmacy.find().populate(populate).sort(sort);

      return successResponse("Success", {
        records: data,
      });
    }
  } catch (error) {
    return errorResponse(error);
  }
};
