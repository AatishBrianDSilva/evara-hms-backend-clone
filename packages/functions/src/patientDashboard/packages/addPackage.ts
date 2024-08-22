import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import MasterPackage from "@evara-backend/core/models/patientDashboard/packages/MasterPackage";
import PatientPackage from "@evara-backend/core/models/patientDashboard/packages/PatientPackage";
import PatientProcedures from "@evara-backend/core/src/models/patientDashboard/procedure/PatientProcedure";
import PatientInvestigation from "@evara-backend/core/src/models/patientDashboard/investigation/PatientInvestigation";
import PatientCryoPreservation from "@evara-backend/core/src/models/patientDashboard/cryoPreservation/PatientCryoPreservation";
import PatientService from "@evara-backend/core/src/models/patientDashboard/services/PatientService";
import PatientTreatmentCycle from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/PatientTreatmentCycle";
import { extractAuthorizerDetails } from "@evara-backend/core/lib/utils/extractAuthorizerDetails";
import { EPatientBillingServiceType } from "@evara-backend/core/models/patientDashboard/Billings/PatientBilling";
import { publishBillingServiceToSNS } from "@evara-backend/core/lib/utils/publishBillingServiceToSNS";
import mongoose from "mongoose";
import MasterTreatmentCycle from "@evara-backend/core/models/patientDashboard/treatmentCycle/MasterTreatmentCycle";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;
  const auth = extractAuthorizerDetails(event);

  let session;

  try {
    // Connect to MongoDB
    console.log("Connecting to MongoDB...");
    await connectMongoDb();
    console.log("Connected to MongoDB.");

    if (!event.body) {
      console.error("No data provided in the request body.");
      throw new ErrorMessage(400, "Data is required");
    }

    // Start a session for the transaction
    session = await mongoose.startSession();
    session.startTransaction();

    // Parse the body from the event
    const data = JSON.parse(event.body);
    console.log("Parsed request body:", data);

    // Add clinicId and branchId from auth details
    data.clinicId = auth.clinicId;
    data.branchId = auth.branchId;

    console.log("Data with clinic and branch IDs:", data);

    for (let i = 0; i < data.length; i++) {
      data[i].clinicId = auth.clinicId;
      data[i].branchId = auth.branchId;

      console.log(`Processing package ${i + 1}:`, data[i]);

      const patientPackage = new PatientPackage({
        ...data[i],
        doctor: data[i].doctor, // Include doctor ID in patient package
      });
      const newPackage = await patientPackage.save({ session });

      console.log(`Saved package ${i + 1}:`, newPackage);

      const masterPackage = await MasterPackage.findById(newPackage.package).lean();

      if (masterPackage) {
        console.log(`Master package found for package ${i + 1}:`, masterPackage);

        // Handle procedures in the package
        if (masterPackage.procedures && masterPackage.procedures.length > 0) {
          for (let j = 0; j < masterPackage.procedures.length; j++) {
            const procedureData = masterPackage.procedures[j];
            const procedurePayload = {
              caseId: data[i].caseId,
              patient: data[i].patient,
              patientCode: data[i].patientCode,
              clinicId: data[i].clinicId,
              branchId: data[i].branchId,
              procedure: procedureData.itemId,
              date: data[i].date,
              doctor: data[i].doctor, // Include doctor ID in each procedure
              status: "Scheduled",
            };
            const procedure = new PatientProcedures(procedurePayload);
            await procedure.save({ session });
          }
        }

        // Handle investigations in the package
        if (masterPackage.investigations && masterPackage.investigations.length > 0) {
          for (let j = 0; j < masterPackage.investigations.length; j++) {
            const investigationData = masterPackage.investigations[j];
            const investigationPayload = {
              caseId: data[i].caseId,
              patient: data[i].patient,
              patientCode: data[i].patientCode,
              clinicId: data[i].clinicId,
              branchId: data[i].branchId,
              investigation: investigationData.itemId,
              date: data[i].date,
              doctor: data[i].doctor, // Include doctor ID in each investigation
              status: "Scheduled",
            };
            const investigation = new PatientInvestigation(investigationPayload);
            await investigation.save({ session });
          }
        }

        // Handle cryo preservations in the package
        if (masterPackage.cryoPreservations && masterPackage.cryoPreservations.length > 0) {
          for (let j = 0; j < masterPackage.cryoPreservations.length; j++) {
            const cryoPreservationData = masterPackage.cryoPreservations[j];
            const cryoPreservationPayload = {
              caseId: data[i].caseId,
              patient: data[i].patient,
              patientCode: data[i].patientCode,
              clinicId: data[i].clinicId,
              branchId: data[i].branchId,
              cryo: cryoPreservationData.itemId,
              date: data[i].date,
              doctor: data[i].doctor, // Include doctor ID in each cryo preservation
              status: "Scheduled",
            };
            const cryoPreservation = new PatientCryoPreservation(cryoPreservationPayload);
            await cryoPreservation.save({ session });
          }
        }

        // Handle services in the package
        if (masterPackage.services && masterPackage.services.length > 0) {
          for (let j = 0; j < masterPackage.services.length; j++) {
            const serviceData = masterPackage.services[j];
            const servicePayload = {
              caseId: data[i].caseId,
              patient: data[i].patient,
              patientCode: data[i].patientCode,
              clinicId: data[i].clinicId,
              branchId: data[i].branchId,
              service: serviceData.itemId,
              date: data[i].date,
              doctor: data[i].doctor, // Include doctor ID in each service
              status: "Scheduled",
            };
            const service = new PatientService(servicePayload);
            await service.save({ session });
          }
        }

        // Handle treatment cycles in the package only if the patient is female
        if (masterPackage.treatmentCycles && masterPackage.treatmentCycles.length > 0) {
          for (let j = 0; j < masterPackage.treatmentCycles.length; j++) {
            const treatmentCycleData = masterPackage.treatmentCycles[j];

            // Calculate the cycle number for the patient
            const existingCycleCount = await PatientTreatmentCycle.countDocuments({
              patient: data[i].patient,
              clinicId: data[i].clinicId,
            });

            const masterTreatmentCycle = await MasterTreatmentCycle.findById(
              treatmentCycleData.itemId
            )
              .populate("treatmentCycle")
              .lean();

            if (!masterTreatmentCycle || !masterTreatmentCycle.treatmentCycle) {
              throw new ErrorMessage(404, "Default treatment cycle not found or missing details");
            }

            const defaultTreatmentCycle = masterTreatmentCycle.treatmentCycle;

            const treatmentCyclePayload = {
              caseId: data[i].caseId,
              patient: data[i].patient,
              patientCode: data[i].patientCode,
              clinicId: data[i].clinicId,
              branchId: data[i].branchId,
              cycle: treatmentCycleData.itemId,
              cycleNo: existingCycleCount + 1, // Set cycleNo based on existing cycles
              date: data[i].date,
              doctor: data[i].doctor, // Include doctor ID in each treatment cycle
              status: "Scheduled",
              protocols:
                defaultTreatmentCycle?.protocols?.map((protocol) => ({
                  name: protocol.name,
                  category: protocol.category,
                  status: "Pending",
                  details: {},
                })) || [],
              checklists:
                defaultTreatmentCycle?.checklists?.map((checklist) => ({
                  name: checklist.name,
                  category: checklist.category,
                  status: "Pending",
                  details: {},
                })) || [],
              reports:
                defaultTreatmentCycle?.reports?.map((report) => ({
                  name: report.name,
                  reportType: report.reportType,
                  category: report.category,
                  status: "Pending",
                  details: {},
                })) || [],
              metrics:
                defaultTreatmentCycle?.metrics?.map((metric) => ({
                  name: metric.name,
                  metricType: metric.metricType,
                  category: metric.category,
                  status: "Pending",
                  details: {},
                })) || [],
            };
            const treatmentCycle = new PatientTreatmentCycle(treatmentCyclePayload);
            await treatmentCycle.save({ session });
          }
        }

        const serviceName = masterPackage.name;

        console.log(`Publishing package ${i + 1} to SNS...`);
        await publishBillingServiceToSNS(
          newPackage.patientCode,
          newPackage.doctor,
          newPackage.package,
          newPackage._id as any,
          EPatientBillingServiceType.Package,
          serviceName,
          masterPackage.price,
          1,
          auth.clinicId,
          auth.branchId
        );
        console.log(`Package ${i + 1} published to SNS.`);
      } else {
        throw new ErrorMessage(404, `Master Package not found for package ${i + 1}`);
      }
    }

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    console.log("All packages and associated items processed successfully.");
    return successResponse("Package and associated items created successfully");
  } catch (error) {
    // If any error occurs, abort the transaction
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    console.error("Error processing packages:", error);
    return errorResponse(error);
  }
};
