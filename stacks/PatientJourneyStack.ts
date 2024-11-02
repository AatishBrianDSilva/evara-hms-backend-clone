import { StackContext, use } from 'sst/constructs';
import { MainStack } from './MainStack';

export const PatientJourneyStack = ({ stack }: StackContext) => {
  const { api } = use(MainStack);

  api.addRoutes(stack, {
    // Patient Dashboard Start
    // INVESTIGATIONS
    //Patient Investigations
    'POST /investigations/add':
      'packages/functions/src/patientDashboard/investigations/addInvestigation.main',
    'GET /investigations':
      'packages/functions/src/patientDashboard/investigations/getInvestigations.main',
    'GET /investigations/{id}':
      'packages/functions/src/patientDashboard/investigations/getInvestigationById.main',
    'PUT /investigations/{id}':
      'packages/functions/src/patientDashboard/investigations/editInvestigation.main',
    'DELETE /investigations/{id}':
      'packages/functions/src/patientDashboard/investigations/deleteInvestigation.main',

    // Services
    // Patient Services
    'POST /services/add':
      'packages/functions/src/patientDashboard/services/addService.main',
    'GET /services':
      'packages/functions/src/patientDashboard/services/getServices.main',
    'DELETE /services/{id}':
      'packages/functions/src/patientDashboard/services/deleteService.main',

    //Treatment Advice

    'POST /treatment-advice/add':
      'packages/functions/src/patientDashboard/treatmentAdvice/addTreatmentAdvice.main',
    'GET /treatment-advice':
      'packages/functions/src/patientDashboard/treatmentAdvice/getTreatmentAdvices.main',
    'DELETE /treatment-advice/{id}':
      'packages/functions/src/patientDashboard/treatmentAdvice/deleteTreatmentAdvice.main',

    //PROCEDURES
    //Patient Procedures
    'POST /procedures/add':
      'packages/functions/src/patientDashboard/procedures/addProcedure.main',
    'GET /procedures':
      'packages/functions/src/patientDashboard/procedures/getProcedures.main',
    'GET /procedures/{id}':
      'packages/functions/src/patientDashboard/procedures/getProcedureById.main',
    'PUT /procedures/{id}':
      'packages/functions/src/patientDashboard/procedures/editProcedure.main',
    'DELETE /procedures/{id}':
      'packages/functions/src/patientDashboard/procedures/deleteProcedure.main',

    //CRYO-PRESERVATIONS
    //Patient Cryo-Preservations
    'POST /cryo-preservations/add':
      'packages/functions/src/patientDashboard/cryoPreservations/addCryoPreservation.main',
    'GET /cryo-preservations':
      'packages/functions/src/patientDashboard/cryoPreservations/getCryoPreservations.main',
    'GET /cryo-preservations/{id}':
      'packages/functions/src/patientDashboard/cryoPreservations/getCryoPreservationById.main',
    'PUT /cryo-preservations/{id}':
      'packages/functions/src/patientDashboard/cryoPreservations/editCryoPreservation.main',
    'DELETE /cryo-preservations/{id}':
      'packages/functions/src/patientDashboard/cryoPreservations/deleteCryoPreservation.main',

    //TREATMENT CYCLES
    //Patient Treatment Cycles
    'POST /treatment-cycles/add':
      'packages/functions/src/patientDashboard/treatmentCycle/addTreatmentCycle.main',
    'GET /treatment-cycles':
      'packages/functions/src/patientDashboard/treatmentCycle/getTreatmentCycles.main',
    'GET /treatment-cycles/{id}':
      'packages/functions/src/patientDashboard/treatmentCycle/getTreatmentCycleById.main',
    'PATCH /treatment-cycles/{id}':
      'packages/functions/src/patientDashboard/treatmentCycle/editTreatmentCycle.main',
    'DELETE /treatment-cycles/{id}':
      'packages/functions/src/patientDashboard/treatmentCycle/deleteTreatmentCycle.main',

    // PACKAGES
    // Patient Packages
    'POST /packages/add':
      'packages/functions/src/patientDashboard/packages/addPackage.main',
    'GET /packages':
      'packages/functions/src/patientDashboard/packages/getPackages.main',
    'GET /packages/{id}':
      'packages/functions/src/patientDashboard/packages/getPackageById.main',
    // "PUT /packages/{id}": "packages/functions/src/patientDashboard/packages/editPackage.main",
    'DELETE /packages/{id}':
      'packages/functions/src/patientDashboard/packages/deletePackage.main',

    // Patient Timeline
    'GET /timeline':
      'packages/functions/src/patientDashboard/timeline/timeline.main',

    // Patient History
    'GET /history/{id}':
      'packages/functions/src/patientDashboard/history/getPatientHistory.main',
    'PUT /history/{id}':
      'packages/functions/src/patientDashboard/history/editPatientHistory.main',
    'POST /history/add':
      'packages/functions/src/patientDashboard/history/addPatientHistory.main',

    // Patient Billing
    // Estimations
    'POST /billings/estimations/add':
      'packages/functions/src/patientDashboard/billings/estimation/addEstimation.main',
    'GET /billings/estimations':
      'packages/functions/src/patientDashboard/billings/estimation/getEstimations.main',
    'GET /billings/estimations/{id}':
      'packages/functions/src/patientDashboard/billings/estimation/getEstimationById.main',
    'PUT /billings/estimations/{id}':
      'packages/functions/src/patientDashboard/billings/estimation/editEstimation.main',
    'DELETE /billings/estimations/{id}':
      'packages/functions/src/patientDashboard/billings/estimation/deleteEstimation.main',
    // Billing
    'POST /billings/add':
      'packages/functions/src/patientDashboard/billings/addBilling.main',
    'GET /billings':
      'packages/functions/src/patientDashboard/billings/getBillings.main',
    'GET /billings/{id}':
      'packages/functions/src/patientDashboard/billings/getBillingById.main',
    'PUT /billings/{id}':
      'packages/functions/src/patientDashboard/billings/editBilling.main',
    'PUT /billings/payment-mode/{id}':
      'packages/functions/src/patientDashboard/billings/updatePaidBillMode.main',
    'POST /billings/process':
      'packages/functions/src/patientDashboard/billings/processBilling.main',
    'POST /billings/refund':
      'packages/functions/src/patientDashboard/billings/addRefund.main',
    'GET /billings/refunds':
      'packages/functions/src/patientDashboard/billings/getRefund.main',
    'GET /billings/refunds/{id}':
      'packages/functions/src/patientDashboard/billings/getRefundById.main',
    'DELETE /billings/{id}':
      'packages/functions/src/patientDashboard/billings/deleteBilling.main',

    'GET /master/services/all':
      'packages/functions/src/patientDashboard/billings/getAllServices.main',
    // Patient Pharmacy
    'POST /pharmacy/add':
      'packages/functions/src/patientDashboard/pharmacy/addPharmacy.main',
    'GET /pharmacy/{patientId}':
      'packages/functions/src/patientDashboard/pharmacy/getPharmacy.main',
    'GET /pharmacy/patient/{id}':
      'packages/functions/src/patientDashboard/pharmacy/getPharmacyById.main',
    'GET /pharmacy/all':
      'packages/functions/src/patientDashboard/pharmacy/getAllPharmacy.main',

    // Patient Notes
    'POST /notes/add': 'packages/functions/src/patientDashboard/notes/add.main',
    'GET /notes': 'packages/functions/src/patientDashboard/notes/getAll.main',
    'GET /notes/{id}': 'packages/functions/src/patientDashboard/notes/get.main',
    'PUT /notes/{id}':
      'packages/functions/src/patientDashboard/notes/edit.main',
    'DELETE /notes/{id}':
      'packages/functions/src/patientDashboard/notes/delete.main',

    // Patient Reports
    'GET /reports/patient/{id}':
      'packages/functions/src/reports/getPatientReports.main',
    'GET /reports/download/{id}':
      'packages/functions/src/reports/downloadReport.main',
    'GET /reports':
      'packages/functions/src/patientDashboard/reports/getPatientReports.main',
    'GET /invoices/download/{id}':
      'packages/functions/src/reports/downloadReport.main',
    'POST /files/user-files/download':
      'packages/functions/src/files/downloadFiles.main',
  });
};
