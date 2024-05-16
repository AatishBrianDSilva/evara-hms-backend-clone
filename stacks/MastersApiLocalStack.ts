import { StackContext, use } from "sst/constructs";
import { MainStack } from "./MainStack";

export const MastersApiLocalStack = ({ stack }: StackContext) => {
  const { api } = use(MainStack);

  api.addRoutes(stack, {
    //Local Masters
    // Donors
    "POST /master/donors/add": "packages/functions/src/donors/addDonor.main",
    "GET /master/donors": "packages/functions/src/donors/getDonors.main",
    "GET /master/donors/{id}":
      "packages/functions/src/donors/getDonorById.main",
    "PUT /master/donors/{id}": "packages/functions/src/donors/editDonor.main",
    "PATCH /master/donors/{id}/assign-to-case":
      "packages/functions/src/donors/assignDonorToCase.main",
    "DELETE /master/donors/{id}":
      "packages/functions/src/donors/deleteDonor.main",

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
  });
};
