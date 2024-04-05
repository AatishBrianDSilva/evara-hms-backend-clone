import { Api, StackContext } from "sst/constructs";

export function EvaraStack({ stack }: StackContext) {
  /**
   * Represents the API configuration for the EvaraStack.
   */
  const api = new Api(stack, "Api", {
    defaults: {
      function: {
        timeout: "29 seconds",
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

      // Patient Dashboard Start
      // INVESTIGATIONS
      //Patient Investigations
      "POST /investigations/add":
        "packages/functions/src/patientDashboard/investigations/addInvestigation.main",
      "GET /investigations":
        "packages/functions/src/patientDashboard/investigations/getInvestigations.main",
      "GET /investigations/{id}":
        "packages/functions/src/patientDashboard/investigations/getInvestigationById.main",
      "PUT /investigations/{id}":
        "packages/functions/src/patientDashboard/investigations/editInvestigation.main",
      "DELETE /investigations/{id}":
        "packages/functions/src/patientDashboard/investigations/deleteInvestigation.main",
      // Master Investigations
      "POST /master/investigations/add":
        "packages/functions/src/patientDashboard/master/investigations/addInvestigation.main",
      "GET /master/investigations":
        "packages/functions/src/patientDashboard/master/investigations/getInvestigations.main",
      // Medical Tests
      "POST /master/investigations/default/add":
        "packages/functions/src/patientDashboard/master/investigations/addDefaultTest.main",

      //PROCEDURES
      //Patient Procedures
      "POST /procedures/add":
        "packages/functions/src/patientDashboard/procedures/addProcedure.main",
      "GET /procedures":
        "packages/functions/src/patientDashboard/procedures/getProcedures.main",
      "GET /procedures/{id}":
        "packages/functions/src/patientDashboard/procedures/getProcedureById.main",
      "PUT /procedures/{id}":
        "packages/functions/src/patientDashboard/procedures/editProcedure.main",
      "DELETE /procedures/{id}":
        "packages/functions/src/patientDashboard/procedures/deleteProcedure.main",
      // Master Procedures
      "POST /master/procedures/add":
        "packages/functions/src/patientDashboard/master/procedures/addProcedure.main",
      "GET /master/procedures":
        "packages/functions/src/patientDashboard/master/procedures/getProcedures.main",
      // Medical Procedures
      "POST /master/procedures/default/add":
        "packages/functions/src/patientDashboard/master/procedures/addDefaultProcedure.main",

      //CRYO-PRESERVATIONS
      //Patient Cryo-Preservations
      "POST /cryo-preservations/add":
        "packages/functions/src/patientDashboard/cryoPreservations/addCryoPreservation.main",
      "GET /cryo-preservations":
        "packages/functions/src/patientDashboard/cryoPreservations/getCryoPreservations.main",
      "GET /cryo-preservations/{id}":
        "packages/functions/src/patientDashboard/cryoPreservations/getCryoPreservationById.main",
      "PUT /cryo-preservations/{id}":
        "packages/functions/src/patientDashboard/cryoPreservations/editCryoPreservation.main",
      "DELETE /cryo-preservations/{id}":
        "packages/functions/src/patientDashboard/cryoPreservations/deleteCryoPreservation.main",
      // Master Cryo-Preservations
      "POST /master/cryo-preservations/add":
        "packages/functions/src/patientDashboard/master/cryoPreservations/addCryoPreservation.main",
      "GET /master/cryo-preservations":
        "packages/functions/src/patientDashboard/master/cryoPreservations/getCryoPreservations.main",
      // Default Cryo-Preservations
      "POST /master/cryo-preservations/default/add":
        "packages/functions/src/patientDashboard/master/cryoPreservations/addDefaultCryoPreservation.main",

      //TREATMENT CYCLES
      //Patient Treatment Cycles
      "POST /treatment-cycles/add":
        "packages/functions/src/patientDashboard/treatmentCycle/addTreatmentCycle.main",
      "GET /treatment-cycles":
        "packages/functions/src/patientDashboard/treatmentCycle/getTreatmentCycles.main",
      "GET /treatment-cycles/{id}":
        "packages/functions/src/patientDashboard/treatmentCycle/getTreatmentCycleById.main",
      "PATCH /treatment-cycles/{id}":
        "packages/functions/src/patientDashboard/treatmentCycle/editTreatmentCycle.main",
      "DELETE /treatment-cycles/{id}":
        "packages/functions/src/patientDashboard/treatmentCycle/deleteTreatmentCycle.main",
      // Master Treatment Cycles
      "POST /master/treatment-cycles/add":
        "packages/functions/src/patientDashboard/master/treatmentCycle/addTreatmentCycle.main",
      "GET /master/treatment-cycles":
        "packages/functions/src/patientDashboard/master/treatmentCycle/getTreatmentCycles.main",
      // Default Treatment Cycles
      "POST /master/treatment-cycles/default/add":
        "packages/functions/src/patientDashboard/master/treatmentCycle/addDefaultTreatmentCycle.main",
      // Patient Dashboard End

      // Pharmacy Dashboard Start
      // MASTER
      // Drug Items
      "POST /pharmacy-dashboard/master/drug-items/add":
        "packages/functions/src/pharmacyDashboard/master/drugItem/addDrugItem.main",
      "GET /pharmacy-dashboard/master/drug-items":
        "packages/functions/src/pharmacyDashboard/master/drugItem/getDrugItems.main",
      "PUT /pharmacy-dashboard/master/drug-items/{id}":
        "packages/functions/src/pharmacyDashboard/master/drugItem/updateDrugItem.main",
      "DELETE /pharmacy-dashboard/master/drug-items/{id}":
        "packages/functions/src/pharmacyDashboard/master/drugItem/deleteDrugItem.main",

      // Drug Categories
      "POST /pharmacy-dashboard/master/drug-categories/add":
        "packages/functions/src/pharmacyDashboard/master/drugCategory/addDrugCategory.main",
      "GET /pharmacy-dashboard/master/drug-categories":
        "packages/functions/src/pharmacyDashboard/master/drugCategory/getDrugCategories.main",
      "PUT /pharmacy-dashboard/master/drug-categories/{id}":
        "packages/functions/src/pharmacyDashboard/master/drugCategory/updateDrugCategory.main",
      "DELETE /pharmacy-dashboard/master/drug-categories/{id}":
        "packages/functions/src/pharmacyDashboard/master/drugCategory/deleteDrugCategory.main",

      // Drug Locations
      "POST /pharmacy-dashboard/master/drug-locations/add":
        "packages/functions/src/pharmacyDashboard/master/drugLocation/addDrugLocation.main",
      "GET /pharmacy-dashboard/master/drug-locations":
        "packages/functions/src/pharmacyDashboard/master/drugLocation/getDrugLocations.main",
      "PUT /pharmacy-dashboard/master/drug-locations/{id}":
        "packages/functions/src/pharmacyDashboard/master/drugLocation/updateDrugLocation.main",
      "DELETE /pharmacy-dashboard/master/drug-locations/{id}":
        "packages/functions/src/pharmacyDashboard/master/drugLocation/deleteDrugLocation.main",

      // Drug manufacturers
      "POST /pharmacy-dashboard/master/drug-manufacturers/add":
        "packages/functions/src/pharmacyDashboard/master/drugManufacturer/addDrugManufacturer.main",
      "GET /pharmacy-dashboard/master/drug-manufacturers":
        "packages/functions/src/pharmacyDashboard/master/drugManufacturer/getDrugManufacturers.main",
      "PUT /pharmacy-dashboard/master/drug-manufacturers/{id}":
        "packages/functions/src/pharmacyDashboard/master/drugManufacturer/updateDrugManufacturer.main",
      "DELETE /pharmacy-dashboard/master/drug-manufacturers/{id}":
        "packages/functions/src/pharmacyDashboard/master/drugManufacturer/deleteDrugManufacturer.main",

      // Drug vendors
      "POST /pharmacy-dashboard/master/drug-vendors/add":
        "packages/functions/src/pharmacyDashboard/master/drugVendor/addDrugVendor.main",
      "GET /pharmacy-dashboard/master/drug-vendors":
        "packages/functions/src/pharmacyDashboard/master/drugVendor/getDrugVendors.main",
      "PUT /pharmacy-dashboard/master/drug-vendors/{id}":
        "packages/functions/src/pharmacyDashboard/master/drugVendor/updateDrugVendor.main",
      "DELETE /pharmacy-dashboard/master/drug-vendors/{id}":
        "packages/functions/src/pharmacyDashboard/master/drugVendor/deleteDrugVendor.main",

      // Tax Rates
      "POST /pharmacy-dashboard/master/tax-rates/add":
        "packages/functions/src/pharmacyDashboard/master/taxRate/addTaxRate.main",
      "GET /pharmacy-dashboard/master/tax-rates":
        "packages/functions/src/pharmacyDashboard/master/taxRate/getTaxRates.main",
      "PUT /pharmacy-dashboard/master/tax-rates/{id}":
        "packages/functions/src/pharmacyDashboard/master/taxRate/updateTaxRate.main",
      "DELETE /pharmacy-dashboard/master/tax-rates/{id}":
        "packages/functions/src/pharmacyDashboard/master/taxRate/deleteTaxRate.main",

      // Pharmacy Stock
      "POST /pharmacy-dashboard/master/stock/add":
        "packages/functions/src/pharmacyDashboard/master/pharmacyStock/addPharmacyStock.main",
      "GET /pharmacy-dashboard/master/stock":
        "packages/functions/src/pharmacyDashboard/master/pharmacyStock/getPharmacyStocks.main",
      "GET /pharmacy-dashboard/master/stock/{id}":
        "packages/functions/src/pharmacyDashboard/master/pharmacyStock/getPharmacyStockById.main",
      "PUT /pharmacy-dashboard/master/stock/{id}":
        "packages/functions/src/pharmacyDashboard/master/pharmacyStock/updatePharmacyStock.main",
      "DELETE /pharmacy-dashboard/master/stock/{id}":
        "packages/functions/src/pharmacyDashboard/master/pharmacyStock/deletePharmacyStock.main",

      // Admin Dev
      "GET /admin_dev/automate-medical-investigation":
        "packages/functions/src/admin_dev/automateMedicalInvestigation.main",
      "GET /admin_dev/automate-medical-procedure":
        "packages/functions/src/admin_dev/automateMedicalProcedure.main",
      "GET /admin_dev/automate-cryo-preservation":
        "packages/functions/src/admin_dev/automateMasterCryoPreservations.main",
      "GET /admin_dev/automate-treatment-cycle":
        "packages/functions/src/admin_dev/automateMasterTreatmentCycle.main",
    },
  });

  // Show the URLs in the output
  stack.addOutputs({
    ApiEndpoint: api.url,
  });
}
