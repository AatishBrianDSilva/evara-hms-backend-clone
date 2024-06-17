import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import PatientInvestigation from "@evara-backend/core/src/models/patientDashboard/investigation/PatientInvestigation";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import MasterInvestigation from "@evara-backend/core/src/models/patientDashboard/investigation/MasterInvestigations";
import { EPatientBillingServiceType } from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling";
import { ETestType } from "@evara-backend/core/src/models/patientDashboard/investigation/MedicalTests";
import { publishBillingServiceToSNS } from "@evara-backend/core/src/lib/utils/publishBillingServiceToSNS";
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    // Connect to MongoDB
    await connectMongoDb();

    if (event.body == null) {
      throw new ErrorMessage(400, "Data is required");
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    // TODO: Remove clinicId and branchId after adding authentication
    data.clinicId = auth?.clinicId;
    data.branchId = auth?.branchId;

    console.log("Data: ", data);

    for (let i = 0; i < data.length; i++) {
      data[i].clinicId = "EV";
      const investigation = new PatientInvestigation(data[i]);

      const newinvestigation = await investigation.save();

      const masterInvestigation = await MasterInvestigation.findById(
        investigation.investigation
      ).lean();

      if (masterInvestigation) {
        const serviceName =
          masterInvestigation.testType === ETestType.BloodTest
            ? `Blood Test - ${masterInvestigation.name}`
            : masterInvestigation.name;

        // Publish to SNS
        await publishBillingServiceToSNS(
          newinvestigation.patientCode,
          newinvestigation.doctor,
          newinvestigation.investigation,
          newinvestigation._id,
          EPatientBillingServiceType.Investigation,
          serviceName,
          masterInvestigation.cost,
          1
        );
      } else {
        console.error("Master investigation not found");
      }
    }
    // Return success response
    return successResponse("Investigation created successfully");
  } catch (error) {
    return errorResponse(error);
  }
};
