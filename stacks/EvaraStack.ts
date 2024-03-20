import { Api, StackContext } from "sst/constructs";

export function EvaraStack({ stack }: StackContext) {
  const api = new Api(stack, "Api", {
    defaults: {
      function: {
        timeout: "25 seconds",
      },
    },
    routes: {
      // Patients
      "POST /patients/{id}/partner/add":
        "packages/functions/src/patients/addPartner.main",
      "POST /patients/add": "packages/functions/src/patients/addPatient.main",
      "GET /patients": "packages/functions/src/patients/getPatients.main",
      "GET /patients/{id}":
        "packages/functions/src/patients/getPatientById.main",
      "PUT /patients/{id}": "packages/functions/src/patients/editPatient.main",
      "DELETE /patients/{id}":
        "packages/functions/src/patients/deletePatient.main",

      // Doctors
      "POST /doctors/add": "packages/functions/src/doctors/addDoctor.main",
      "GET /doctors": "packages/functions/src/doctors/getDoctors.main",
      "GET /doctors/{id}": "packages/functions/src/doctors/getDoctorById.main",
      "PUT /doctors/{id}": "packages/functions/src/doctors/editDoctor.main",
      "DELETE /doctors/{id}":
        "packages/functions/src/doctors/deleteDoctor.main",

      // Appointments
      "POST /appointments/add":
        "packages/functions/src/appointments/addAppointment.main",
      "GET /appointments":
        "packages/functions/src/appointments/getAppointments.main",
      "GET /appointments/upcoming":
        "packages/functions/src/appointments/getUpcomingAppointments.main",
      "GET /appointments/{id}":
        "packages/functions/src/appointments/getAppointmentById.main",
      "PUT /appointments/{id}":
        "packages/functions/src/appointments/editAppointment.main",
      "DELETE /appointments/{id}":
        "packages/functions/src/appointments/deleteAppointment.main",

      //Patient Investigations
      "POST /investigations/add":
        "packages/functions/src/investigations/addInvestigation.main",
      "GET /investigations":
        "packages/functions/src/investigations/getInvestigations.main",
      "GET /investigations/{id}":
        "packages/functions/src/investigations/getInvestigationById.main",
      "PUT /investigations/{id}":
        "packages/functions/src/investigations/editInvestigation.main",
      "DELETE /investigations/{id}":
        "packages/functions/src/investigations/deleteInvestigation.main",

      // Master Investigations
      "POST /master/investigations/add":
        "packages/functions/src/master/investigations/addInvestigation.main",
      "GET /master/investigations":
        "packages/functions/src/master/investigations/getInvestigations.main",

      // Medical Tests
      "POST /master/medical-tests/add":
        "packages/functions/src/master/MedicalTests/addTest.main",

      // Admin Dev
      "GET /admin_dev/automate-medical-investigation":
        "packages/functions/src/admin_dev/automateMedicalInvestigation.main",
    },
  });

  // Show the URLs in the output
  stack.addOutputs({
    ApiEndpoint: api.url,
  });
}
