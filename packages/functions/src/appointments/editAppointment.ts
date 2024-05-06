import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import Appointments from "@evara-backend/core/src/models/Appointments";
import Doctors from "@evara-backend/core/src/models/Doctors";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";

export const main: APIGatewayProxyHandler = async (event, _context) => {
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

    if (event.body == null) {
      throw new ErrorMessage(400, "Data is required");
    }

    const updates = JSON.parse(event.body);

    if (!updates.date || !updates.time) {
      throw new ErrorMessage(400, "Date and Time is required");
    }

    if (updates.date || updates.time) {
      const conflictingAppointment = await Appointments.findOne({
        _id: { $ne: id },
        date: updates.date,
        time: updates.time,
        doctorId: updates.doctorId,
      });

      if (conflictingAppointment) {
        throw new ErrorMessage(400, "Conflict with another appointment");
      }
    }

    const updatedAppointment = await Appointments.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );

    if (!updatedAppointment) {
      throw new ErrorMessage(404, "Appointment Not found");
    }

    // Parse the body from the event
    // console.log(data);
    return successResponse("Success", updatedAppointment);
  } catch (error) {
    return errorResponse(error);
  }
};
