import { StackContext, use } from "sst/constructs";
import { MainStack } from "./MainStack";

export const MastersApiStack = ({ stack }: StackContext) => {
  const { api } = use(MainStack);

  api.addRoutes(stack, {
    //Global Masters
    //Doctors
    "POST /master/doctors/add":
      "packages/functions/src/mastersDashboard/doctors/addDoctor.main",
    "GET /master/doctors":
      "packages/functions/src/mastersDashboard/doctors/getDoctors.main",
    "GET /master/doctors/{id}":
      "packages/functions/src/mastersDashboard/doctors/getDoctorById.main",
    "PUT /master/doctors/{id}":
      "packages/functions/src/mastersDashboard/doctors/editDoctor.main",
    "DELETE /master/doctors/{id}":
      "packages/functions/src/mastersDashboard/doctors/deleteDoctor.main",

    // Users
    "POST /master/users/add":
      "packages/functions/src/mastersDashboard/global/users/addUser.main",
    "GET /master/users":
      "packages/functions/src/mastersDashboard/global/users/getUsers.main",
    "GET /master/users/{id}":
      "packages/functions/src/mastersDashboard/global/users/getUserById.main",
    "PUT /master/users/{id}":
      "packages/functions/src/mastersDashboard/global/users/updateUser.main",
    "PATCH /master/users/change-password":
      "packages/functions/src/mastersDashboard/global/users/updatePassword.main",
    "DELETE /master/users/{id}":
      "packages/functions/src/mastersDashboard/global/users/deleteUser.main",

    // Branches
    "POST /master/branch/add":
      "packages/functions/src/mastersDashboard/global/branch/addBranch.main",
    "GET /master/branch":
      "packages/functions/src/mastersDashboard/global/branch/getBranches.main",
    "GET /master/branch/{id}":
      "packages/functions/src/mastersDashboard/global/branch/getBranchById.main",
    "PUT /master/branch/{id}":
      "packages/functions/src/mastersDashboard/global/branch/editBranch.main",
    "DELETE /master/branch/{id}":
      "packages/functions/src/mastersDashboard/global/branch/deleteBranch.main",

    //End Global Masters

    //Local Masters
    //Appointment Source
    "POST /master/appointment/source/add":
      "packages/functions/src/mastersDashboard/local/appointments/source/add.main",
    "GET /master/appointment/source":
      "packages/functions/src/mastersDashboard/local/appointments/source/getAll.main",
    "GET /master/appointment/source/{id}":
      "packages/functions/src/mastersDashboard/local/appointments/source/get.main",
    "PUT /master/appointment/source/{id}":
      "packages/functions/src/mastersDashboard/local/appointments/source/edit.main",
    "DELETE /master/appointment/source/{id}":
      "packages/functions/src/mastersDashboard/local/appointments/source/delete.main",

    //Appointment Reason
    "POST /master/appointment/reason/add":
      "packages/functions/src/mastersDashboard/local/appointments/reason/add.main",
    "GET /master/appointment/reason":
      "packages/functions/src/mastersDashboard/local/appointments/reason/getAll.main",
    "GET /master/appointment/reason/{id}":
      "packages/functions/src/mastersDashboard/local/appointments/reason/get.main",
    "PUT /master/appointment/reason/{id}":
      "packages/functions/src/mastersDashboard/local/appointments/reason/edit.main",
    "DELETE /master/appointment/reason/{id}":
      "packages/functions/src/mastersDashboard/local/appointments/reason/delete.main",

    //Patient Source
    "POST /master/patient/source/add":
      "packages/functions/src/mastersDashboard/local/patients/source/add.main",
    "GET /master/patient/source":
      "packages/functions/src/mastersDashboard/local/patients/source/getAll.main",
    "GET /master/patient/source/{id}":
      "packages/functions/src/mastersDashboard/local/patients/source/get.main",
    "PUT /master/patient/source/{id}":
      "packages/functions/src/mastersDashboard/local/patients/source/edit.main",
    "DELETE /master/patient/source/{id}":
      "packages/functions/src/mastersDashboard/local/patients/source/delete.main",

    //Patient Referral Doctor
    "POST /master/patient/referral-doctor/add":
      "packages/functions/src/mastersDashboard/local/patients/referralDoctors/add.main",
    "GET /master/patient/referral-doctor":
      "packages/functions/src/mastersDashboard/local/patients/referralDoctors/getAll.main",
    "GET /master/patient/referral-doctor/{id}":
      "packages/functions/src/mastersDashboard/local/patients/referralDoctors/get.main",
    "PUT /master/patient/referral-doctor/{id}":
      "packages/functions/src/mastersDashboard/local/patients/referralDoctors/edit.main",
    "DELETE /master/patient/referral-doctor/{id}":
      "packages/functions/src/mastersDashboard/local/patients/referralDoctors/delete.main",

    //Patient ID Type
    "POST /master/patient/id-type/add":
      "packages/functions/src/mastersDashboard/local/patients/idType/add.main",
    "GET /master/patient/id-type":
      "packages/functions/src/mastersDashboard/local/patients/idType/getAll.main",
    "GET /master/patient/id-type/{id}":
      "packages/functions/src/mastersDashboard/local/patients/idType/get.main",
    "PUT /master/patient/id-type/{id}":
      "packages/functions/src/mastersDashboard/local/patients/idType/edit.main",
    "DELETE /master/patient/id-type/{id}":
      "packages/functions/src/mastersDashboard/local/patients/idType/delete.main",

    //Notes Treatment Advice
    "POST /master/notes/treatment-advice/add":
      "packages/functions/src/mastersDashboard/local/notes/treatmentAdvice/add.main",
    "GET /master/notes/treatment-advice":
      "packages/functions/src/mastersDashboard/local/notes/treatmentAdvice/getAll.main",
    "GET /master/notes/treatment-advice/{id}":
      "packages/functions/src/mastersDashboard/local/notes/treatmentAdvice/get.main",
    "PUT /master/notes/treatment-advice/{id}":
      "packages/functions/src/mastersDashboard/local/notes/treatmentAdvice/edit.main",
    "DELETE /master/notes/treatment-advice/{id}":
      "packages/functions/src/mastersDashboard/local/notes/treatmentAdvice/delete.main",

    //Notes Observation
    "POST /master/notes/observation/add":
      "packages/functions/src/mastersDashboard/local/notes/observation/add.main",
    "GET /master/notes/observation":
      "packages/functions/src/mastersDashboard/local/notes/observation/getAll.main",
    "GET /master/notes/observation/{id}":
      "packages/functions/src/mastersDashboard/local/notes/observation/get.main",
    "PUT /master/notes/observation/{id}":
      "packages/functions/src/mastersDashboard/local/notes/observation/edit.main",
    "DELETE /master/notes/observation/{id}":
      "packages/functions/src/mastersDashboard/local/notes/observation/delete.main",

    // consents
    "POST /master/consents/add":
      "packages/functions/src/mastersDashboard/local/consents/add.main",
    "GET /master/consents":
      "packages/functions/src/mastersDashboard/local/consents/getAll.main",
    "GET /master/consents/{id}":
      "packages/functions/src/mastersDashboard/local/consents/get.main",
    "PUT /master/consents/{id}":
      "packages/functions/src/mastersDashboard/local/consents/edit.main",
    "DELETE /master/consents/{id}":
      "packages/functions/src/mastersDashboard/local/consents/delete.main",

    //End Local Masters

    //Service Masters
    // Master Investigations
    "POST /master/investigations/add":
      "packages/functions/src/mastersDashboard/service/investigations/addInvestigation.main",
    "GET /master/investigations":
      "packages/functions/src/mastersDashboard/service/investigations/getInvestigations.main",
    "GET /master/investigations/{id}":
      "packages/functions/src/mastersDashboard/service/investigations/getInvestigationById.main",
    "PUT /master/investigations/{id}":
      "packages/functions/src/mastersDashboard/service/investigations/editInvestigation.main",
    // Default Tests
    "POST /master/investigations/default/add":
      "packages/functions/src/mastersDashboard/service/investigations/addDefaultTest.main",
    "GET /master/investigations/default":
      "packages/functions/src/mastersDashboard/service/investigations/getDefaultInvestigations.main",

    // Master Services
    "POST /master/services/add":
      "packages/functions/src/mastersDashboard/service/services/addService.main",
    "GET /master/services":
      "packages/functions/src/mastersDashboard/service/services/getServices.main",
    "GET /master/services/{id}":
      "packages/functions/src/mastersDashboard/service/services/getServiceById.main",
    "PUT /master/services/{id}":
      "packages/functions/src/mastersDashboard/service/services/editService.main",
    // Default Services
    "POST /master/services/default/add":
      "packages/functions/src/mastersDashboard/service/services/addDefaultService.main",
    "GET /master/services/default":
      "packages/functions/src/mastersDashboard/service/services/getDefaultServices.main",

    // Master Procedures
    "POST /master/procedures/add":
      "packages/functions/src/mastersDashboard/service/procedures/addProcedure.main",
    "GET /master/procedures":
      "packages/functions/src/mastersDashboard/service/procedures/getProcedures.main",
    "GET /master/procedures/{id}":
      "packages/functions/src/mastersDashboard/service/procedures/getProcedureById.main",
    "PUT /master/procedures/{id}":
      "packages/functions/src/mastersDashboard/service/procedures/editProcedure.main",
    // Medical Procedures
    "POST /master/procedures/default/add":
      "packages/functions/src/mastersDashboard/service/procedures/addDefaultProcedure.main",
    "GET /master/procedures/default":
      "packages/functions/src/mastersDashboard/service/procedures/getDefaultProcedures.main",

    // Master Cryo-Preservations
    "POST /master/cryo-preservations/add":
      "packages/functions/src/mastersDashboard/service/cryoPreservations/addCryoPreservation.main",
    "GET /master/cryo-preservations":
      "packages/functions/src/mastersDashboard/service/cryoPreservations/getCryoPreservations.main",
    "GET /master/cryo-preservations/{id}":
      "packages/functions/src/mastersDashboard/service/cryoPreservations/getCryoPreservationById.main",
    "PUT /master/cryo-preservations/{id}":
      "packages/functions/src/mastersDashboard/service/cryoPreservations/editCryoPreservation.main",
    // Default Cryo-Preservations
    "POST /master/cryo-preservations/default/add":
      "packages/functions/src/mastersDashboard/service/cryoPreservations/addDefaultCryoPreservation.main",
    "GET /master/cryo-preservations/default":
      "packages/functions/src/mastersDashboard/service/cryoPreservations/getDefaultCryoPreservations.main",

    // Master Treatment Cycles
    "POST /master/treatment-cycles/add":
      "packages/functions/src/mastersDashboard/service/treatmentCycle/addTreatmentCycle.main",
    "GET /master/treatment-cycles":
      "packages/functions/src/mastersDashboard/service/treatmentCycle/getTreatmentCycles.main",
    "GET /master/treatment-cycles/{id}":
      "packages/functions/src/mastersDashboard/service/treatmentCycle/getTreatmentCycleById.main",
    "PUT /master/treatment-cycles/{id}":
      "packages/functions/src/mastersDashboard/service/treatmentCycle/editTreatmentCycle.main",
    // Default Treatment Cycles
    "POST /master/treatment-cycles/default/add":
      "packages/functions/src/mastersDashboard/service/treatmentCycle/addDefaultTreatmentCycle.main",
    "GET /master/treatment-cycles/default":
      "packages/functions/src/mastersDashboard/service/treatmentCycle/getDefaultTreatmentCycles.main",

    // Master Treatment Cycle Consumables
    "POST /master/treatment-cycles/consumables/add":
      "packages/functions/src/mastersDashboard/service/treatmentCycle/consumable/addTreatmentCycleConsumable.main",
    "GET /master/treatment-cycles/consumables":
      "packages/functions/src/mastersDashboard/service/treatmentCycle/consumable/getTreatmentCycleConsumables.main",
    "GET /master/treatment-cycles/consumables/{id}":
      "packages/functions/src/mastersDashboard/service/treatmentCycle/consumable/getTreatmentCycleConsumableById.main",
    "PUT /master/treatment-cycles/consumables/{id}":
      "packages/functions/src/mastersDashboard/service/treatmentCycle/consumable/editTreatmentCycleConsumable.main",

    // Master Treatment Cycle Stage
    "POST /master/treatment-cycles/stage/add":
      "packages/functions/src/mastersDashboard/service/treatmentCycle/stage/addTreatmentCycleStage.main",
    "GET /master/treatment-cycles/stage":
      "packages/functions/src/mastersDashboard/service/treatmentCycle/stage/getTreatmentCycleStages.main",
    "GET /master/treatment-cycles/stage/{id}":
      "packages/functions/src/mastersDashboard/service/treatmentCycle/stage/getTreatmentCycleStageById.main",
    "PUT /master/treatment-cycles/stage/{id}":
      "packages/functions/src/mastersDashboard/service/treatmentCycle/stage/editTreatmentCycleStage.main",

    //End Service Masters
  });
};
