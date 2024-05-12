import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import Appointments from "@evara-backend/core/src/models/Appointments";
import Doctors from "@evara-backend/core/src/models/mastersDashboard/Doctors";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    // Connect to MongoDB
    await connectMongoDb();

    if (event.pathParameters === null) {
      throw new ErrorMessage(400, "Path parameters are null");
    }

    // Safely access the id property
    const id = event.pathParameters["id"];
    if (!id) {
      throw new ErrorMessage(400, "Id is not provided");
    }

    const populate = {
      path: "doctorId",
      select: "firstName lastName desgination",
      model: Doctors.modelName,
    };

    const appointment = await Appointments.findById(id).populate(populate);

    if (!appointment) {
      throw new ErrorMessage(404, "Appoinment Not found");
    }

    // Parse the body from the event
    // console.log(data);
    return successResponse("Success", appointment);
  } catch (error) {
    return errorResponse(error);
  }
};
