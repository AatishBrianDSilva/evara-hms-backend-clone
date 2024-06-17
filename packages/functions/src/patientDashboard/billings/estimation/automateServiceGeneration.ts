import { SQSEvent, SQSHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";

import { EPatientBillingServiceType } from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling";
import MasterTreatmentCycle from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/MasterTreatmentCycle";
import PatientInvestigation from "@evara-backend/core/src/models/patientDashboard/investigation/PatientInvestigation";
import PatientCryoPreservation from "@evara-backend/core/src/models/patientDashboard/cryoPreservation/PatientCryoPreservation";
import PatientProcedures from "@evara-backend/core/src/models/patientDashboard/procedure/PatientProcedure";
import PatientService from "@evara-backend/core/src/models/patientDashboard/services/PatientService";
import PatientTreatmentCycle from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/PatientTreatmentCycle";

interface IData {
  clinicId: string;
  branchId: string;
  patientId: string;
  patientCode: string;
  caseId: string;
  masterServiceId: string;
  serviceType: EPatientBillingServiceType;
  doctorId: string;
  quantity: string;
}

// Handler function for SQS
export const main: SQSHandler = async (event: SQSEvent) => {
  await connectMongoDb(); // Ensure MongoDB is connected

  try {
    // Iterate over each SQS message
    for (const message of event.Records) {
      const payload = JSON.parse(message.body);

      console.log("Processing message", payload.Message);

      const data: IData = JSON.parse(payload.Message);

      await generateService(data);

      // Success processing message
      console.log("Message processed successfully");
    }
  } catch (error) {
    console.error("Error processing SQS message", error);
    throw error; // Throwing error will cause the message to be re-queued and retried
  }
};

// Add estimation function
const generateService = async (data: IData) => {
  console.log("Data: ", data);
  switch (data.serviceType) {
    case EPatientBillingServiceType.CryoPreservation:
      await PatientCryoPreservation.create({
        clinicId: data.clinicId,
        branchId: data.branchId,
        patient: data.patientId,
        patientCode: data.patientCode,
        caseId: data.caseId,
        cryo: data.masterServiceId,
        doctor: data.doctorId,
        date: new Date(),
      });
      break;
    case EPatientBillingServiceType.Investigation:
      await PatientInvestigation.create({
        clinicId: data.clinicId,
        branchId: data.branchId,
        patient: data.patientId,
        patientCode: data.patientCode,
        caseId: data.caseId,
        investigation: data.masterServiceId,
        doctor: data.doctorId,
        date: new Date(),
      });
      break;
    case EPatientBillingServiceType.Procedure:
      await PatientProcedures.create({
        clinicId: data.clinicId,
        branchId: data.branchId,
        patient: data.patientId,
        patientCode: data.patientCode,
        caseId: data.caseId,
        procedure: data.masterServiceId,
        doctor: data.doctorId,
        date: new Date(),
      });
      break;
    case EPatientBillingServiceType.Service:
      await PatientService.create({
        clinicId: data.clinicId,
        branchId: data.branchId,
        patient: data.patientId,
        patientCode: data.patientCode,
        caseId: data.caseId,
        service: data.masterServiceId,
        doctor: data.doctorId,
        date: new Date(),
      });
      break;
    case EPatientBillingServiceType.TreatmentCycle:
      await createTreatmentCycle(data);
      break;
    default:
      throw new ErrorMessage(400, "Invalid service type: " + data.serviceType);
  }
};

const createTreatmentCycle = async (data: IData) => {
  const masterTreatmentCycle = await MasterTreatmentCycle.findById(
    data.masterServiceId
  )
    .populate("treatmentCycle")
    .lean();

  if (!masterTreatmentCycle) {
    throw new ErrorMessage(404, "Default treatment cycle not found");
  }

  const existingTreatmentCycle = await PatientTreatmentCycle.countDocuments({
    cycle: masterTreatmentCycle._id,
  });

  const defaultTreatmentCycle = masterTreatmentCycle.treatmentCycle;

  const newTreatmentCycle = {
    clinidId: data.clinicId,
    branchId: data.branchId,
    patient: data.patientId,
    patientCode: data.patientCode,
    caseId: data.caseId,
    doctor: data.doctorId,
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
  };

  const treatmentCycle = new PatientTreatmentCycle(newTreatmentCycle);
  const savedTreatmentCycle = await treatmentCycle.save();
};
