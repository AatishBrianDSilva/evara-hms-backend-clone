import { APIGatewayProxyHandler } from "aws-lambda";
import Appointments from "@evara-backend/core/src/models/Appointments";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import { extractAuthorizerDetails } from "@evara-backend/core/lib/utils/extractAuthorizerDetails";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const auth = extractAuthorizerDetails(event);

  try {
    // Connect to MongoDB
    await connectMongoDb();

    if (event.body == null) {
      throw new ErrorMessage(400, "Doctor's data is required");
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    // TODO: Remove clinicId and branchId after adding authentication
    data.clinicId = auth?.clinicId;
    data.branchId = auth?.branchId;

    console.log("data", data);

    // Check if there is an existing appointment for the date and time
    const existingAppointment = await Appointments.findOne({
      date: data.date,
      time: data.time,
      doctorId: data.doctorId,
    });

    if (existingAppointment) {
      // Return an error response if an appointment already exists
      throw new ErrorMessage(
        400,
        "An appointment already exists for the specified date and time"
      );
    }

    // Create a new doctor document
    const newAppointment = new Appointments(data);

    console.log("newAppointment", newAppointment);

    // Save the doctor to the database
    const appointment = await newAppointment.save();

    // Return success response
    const responseData = {
      appointmentId: appointment._id,
    };
    return successResponse("Appointment created successfully", responseData);
  } catch (error) {
    return errorResponse(error);
  }
};
