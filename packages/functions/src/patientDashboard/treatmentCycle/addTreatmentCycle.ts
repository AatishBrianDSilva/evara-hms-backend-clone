import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import PatientTreatmentCycle from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/PatientTreatmentCycle";
import MasterTreatmentCycle from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/MasterTreatmentCycle";
import { log } from "console";
import { publishBillingServiceToSNS } from "@evara-backend/core/src/lib/utils/publishBillingServiceToSNS";
import { EPatientBillingServiceType } from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

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
      const masterTreatmentCycle = await MasterTreatmentCycle.findById(data[i].cycle)
        .populate("treatmentCycle")
        .lean();

      if (!masterTreatmentCycle) {
        throw new ErrorMessage(404, "Default treatment cycle not found");
      }

      const existingTreatmentCycle = await PatientTreatmentCycle.countDocuments({
        cycle: masterTreatmentCycle._id,
      });
      log("Existing Treatment Cycle: ", existingTreatmentCycle);

      const defaultTreatmentCycle = masterTreatmentCycle.treatmentCycle;

      const newTreatmentCycle = {
        ...data[i],
        cycleNo: existingTreatmentCycle + 1,
        protocols: defaultTreatmentCycle.protocols.map((protocol) => ({
          name: protocol.name,
          category: protocol.category,
          status: "Pending",
          details: {},
        })),
        checklists: defaultTreatmentCycle.checklists.map((checklist) => ({
          name: checklist.name,
          category: checklist.category,
          status: "Pending",
          details: {},
        })),
        reports: defaultTreatmentCycle.reports.map((report) => ({
          name: report.name,
          reportType: report.reportType,
          category: report.category,
          status: "Pending",
          details: {},
        })),
        metrics: defaultTreatmentCycle.metrics.map((metric) => ({
          name: metric.name,
          metricType: metric.metricType,
          category: metric.category,
          status: "Pending",
          details: {},
        })),
        clinicId: "EV",
      };

      const treatmentCycle = new PatientTreatmentCycle(newTreatmentCycle);
      const savedTreatmentCycle = await treatmentCycle.save();

      if (masterTreatmentCycle) {
        const serviceName = masterTreatmentCycle.name;

        // Publish to SNS
        await publishBillingServiceToSNS(
          savedTreatmentCycle.patientCode,
          savedTreatmentCycle.doctor,
          savedTreatmentCycle.cycle,
          savedTreatmentCycle._id,
          EPatientBillingServiceType.TreatmentCycle,
          serviceName,
          masterTreatmentCycle.cost,
          1
        );
      } else {
        console.error("Master Treatment Cycle not found");
      }
    }

    // Return success response
    return successResponse("Treatment Cycle created successfully");
  } catch (error) {
    return errorResponse(error);
  }
};
