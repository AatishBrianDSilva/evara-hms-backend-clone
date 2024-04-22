import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/errorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import PatientCryoPreservation from "@evara-backend/core/src/models/patientDashboard/cryoPreservation/PatientCryoPreservation";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import MasterCryoPreservations from "@evara-backend/core/src/models/patientDashboard/cryoPreservation/MasterCryoPreservations";
import { EPatientBillingServiceType } from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling";
import { publishServiceToSNS } from "@evara-backend/core/src/lib/utils/publishServiceToSNS";

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
      const cryoPreservation = new PatientCryoPreservation(data[i]);
      const newCryoPreservation = await cryoPreservation.save();

      const masterCryoPreservation = await MasterCryoPreservations.findById(
        cryoPreservation.cryo
      ).lean();

      if (masterCryoPreservation) {
        const serviceName = masterCryoPreservation.name;

        // Publish to SNS
        await publishServiceToSNS(
          newCryoPreservation.patientCode,
          newCryoPreservation.doctor,
          newCryoPreservation.cryo,
          newCryoPreservation._id,
          EPatientBillingServiceType.CryoPreservation,
          serviceName,
          masterCryoPreservation.cost,
          1
        );
      } else {
        console.error("Master Cryo Preservation not found");
      }
    }

    // Return success response
    return successResponse("Cryo Preservation created successfully");
  } catch (error) {
    return errorResponse(error);
  }
};
