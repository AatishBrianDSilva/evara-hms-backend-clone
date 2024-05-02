import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";

import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import Doctors from "@evara-backend/core/src/models/mastersDashboard/Doctors";
import { PatientBillingEstimation } from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBillingEstimation";

export const main: APIGatewayProxyHandler = async (event, _context) => {
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
        path: "doctorId",
        model: Doctors.modelName,
      },
    ];

    console.log("Populate: ", populate);

    const data = await PatientBillingEstimation.findById(id)
      .populate(populate)
      .lean();

    console.log("Data: ", JSON.stringify(data, null, 2));

    if (!data) {
      throw new ErrorMessage(404, "Not found");
    }

    return successResponse("Fetched successfully", data);
  } catch (error) {
    return errorResponse(error);
  }
};
