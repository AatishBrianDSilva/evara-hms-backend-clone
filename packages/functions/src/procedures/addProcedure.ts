import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "../../../core/src/lib/utils/errorResponse";
import ErrorMessage from "../../../core/src/lib/utils/errorMessage";
import successResponse from "../../../core/src/lib/utils/successResponse";
import PatientProcedures from "../../../core/src/models/procedures/PatientProcedures";
import { connectMongoDb } from "../../../core/src/lib/db/mongodb";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    // Connect to MongoDB
    await connectMongoDb();

    if (event.body == null) {
      throw new ErrorMessage(400, "Data is required");
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    // TODO: Remove clinicId and branchId after adding authentication
    data.clinicId = "EV";
    // data.branchId = "KL";

    console.log("Data: ", data);

    for (let i = 0; i < data.length; i++) {
      data[i].clinicId = "EV";
      const procedure = new PatientProcedures(data[i]);
      await procedure.save();
    }

    // Return success response
    return successResponse("Procedure created successfully");
  } catch (error) {
    return errorResponse(error);
  }
};
