import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import formatPaginationResult from "@evara-backend/core/src/lib/utils/formatPaginationResult";
import { IPaginateOptions } from "@evara-backend/core/src/lib/types/pagination";
import { log } from "console";
import Doctors from "@evara-backend/core/src/models/mastersDashboard/Doctors";
import { PatientBillingEstimation } from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBillingEstimation";
import { Document } from "mongoose";

interface IPatientBillingEstimation extends Document {
  estimatedPrice: number;
  taxRate?: number;
}

const calculateEstimatedPriceWithoutTax = (
  estimatedPrice: number,
  taxRate: number
): number => {
  return estimatedPrice / (1 + taxRate / 100);
};

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb();

    const params = event.queryStringParameters || {};
    console.log("params", params);
    const {
      page = "1",
      limit = "10",
      sort: sortRaw,
      status,
      patientCode,
    } = params;

    const sort = sortRaw ? JSON.parse(sortRaw) : undefined;

    const populate = [
      {
        path: "doctorId",
        model: Doctors.modelName,
      },
    ];

    const paginate = JSON.parse(params.paginate || "false");

    const query: any = {};
    query.branchId = "KL";
    query.patientCode = patientCode;
    if (status) {
      query.status = status;
    }

    if (paginate) {
      const options: IPaginateOptions = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        lean: true,
      };

      if (status) {
        query.status = status;
      }

      if (sort) {
        options.sort = sort;
      }

      options.populate = populate;

      log("Query", query);

      // Fetching the appointments with pagination
      const result = await PatientBillingEstimation.paginate(query, options);
      const { records, pagination } = formatPaginationResult(result);

      // Update estimatedPrice with the value of estimatedPriceWithoutTax
      // const recordsWithUpdatedEstimatedPrice = records.map((record: IPatientBillingEstimation) => {
      //   const taxRate = record.taxRate || 0;
      //   record.estimatedPrice = calculateEstimatedPriceWithoutTax(record.estimatedPrice, taxRate);
      //   return record;
      // });

      return successResponse("Success", {
        records: records,
        pagination,
      });
    } else {
      const data = await PatientBillingEstimation.find(query)
        .populate(populate)
        .sort(sort)
        .lean();

      // Update estimatedPrice with the value of estimatedPriceWithoutTax
      // const dataWithUpdatedEstimatedPrice = data.map((record: IPatientBillingEstimation) => {
      //   const taxRate = record.taxRate || 0;
      //   record.estimatedPrice = calculateEstimatedPriceWithoutTax(record.estimatedPrice, taxRate);
      //   return record;
      // });

      return successResponse("Success", {
        records: data,
      });
    }
  } catch (error) {
    return errorResponse(error);
  }
};
