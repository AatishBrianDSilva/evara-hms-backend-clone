import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import Doctors from "@evara-backend/core/models/mastersDashboard/Doctors";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();
    // Connect to MongoDB

    if (event.body == null) {
      throw new ErrorMessage(400, "Doctor's data is required");
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    // TODO: Remove clinicId and branchId after adding authentication
    data.clinicId = "EV";
    data.branchId = "KL";

    // TODO: Upload profile image to S3 and get the URL

    // Create a new doctor document
    const newDoctor = new Doctors(data);

    // Save the doctor to the database
    const doctor = await newDoctor.save();

    // Return success response
    const responseData = {
      doctorId: doctor._id,
    };
    return successResponse("Doctor added successfully", responseData);
  } catch (error) {
    return errorResponse(error);
  }
};
