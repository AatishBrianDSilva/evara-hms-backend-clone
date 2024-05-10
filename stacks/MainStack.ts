import {
  Api,
  Queue,
  StackContext,
  Topic,
  Function,
  attachPermissionsToRole,
} from "sst/constructs";
import { Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Duration } from "aws-cdk-lib/core";

export function MainStack({ stack }: StackContext) {
  // Create a default role for the API
  const role = new Role(stack, "ApiRole", {
    assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
    managedPolicies: [
      {
        managedPolicyArn:
          "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
      },
    ],
  });

  attachPermissionsToRole(role, ["ssm"]);

  const billingEstimationDLQ = new Queue(stack, "BillingEstimationDLQ", {
    cdk: {
      queue: {
        queueName: `BillingEstimationDLQ-${stack.stage}`,
        visibilityTimeout: Duration.seconds(300),
      },
    },
  });

  //Create a queue to handle SNS messages from topic "PatientBillingEstimation"
  const billingEstimationQueue = new Queue(stack, "BillingEstimationQueue", {
    consumer: {
      function: {
        handler:
          "packages/functions/src/patientDashboard/billings/estimation/automateEstimation.main",
        timeout: 300,
        role: role,
      },
    },
    cdk: {
      queue: {
        queueName: `BillingEstimationQueue-${stack.stage}`,
        visibilityTimeout: Duration.seconds(300),
        deadLetterQueue: {
          maxReceiveCount: 3,
          queue: billingEstimationDLQ.cdk.queue,
        },
      },
    },
  });

  // Create a topic to add billing estimations for patients
  const billingEstimationTopic = new Topic(stack, "BillingEstimationTopic", {
    subscribers: {
      subscriber: {
        type: "queue",
        queue: billingEstimationQueue,
      },
    },
    cdk: {
      topic: {
        topicName: "BillingEstimationTopic-" + stack.stage,
      },
    },
  });

  /**
   * Represents the API configuration for the MainStack.
   */
  const api = new Api(stack, "Api", {
    authorizers: {
      myAuthorizer: {
        type: "lambda",
        function: new Function(stack, "AuthorizerFunction", {
          handler: "packages/functions/src/authentication/authorizer.main",
          permissions: ["secretsmanager"],
          timeout: "10 seconds",
        }),
      },
    },
    defaults: {
      function: {
        timeout: "29 seconds",
        role: role,
        environment: {
          BILLING_ESTIMATION_TOPIC_ARN: billingEstimationTopic.topicArn,
        },
        permissions: ["sns", "sqs", "secretsmanager"],
      },
      authorizer: "myAuthorizer",
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

      // Donors
      "POST /donors/add": "packages/functions/src/donors/addDonor.main",
      "GET /donors": "packages/functions/src/donors/getDonors.main",
      "GET /donors/{id}": "packages/functions/src/donors/getDonorById.main",
      "PUT /donors/{id}": "packages/functions/src/donors/editDonor.main",
      "DELETE /donors/{id}": "packages/functions/src/donors/deleteDonor.main",

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
      "PATCH /appointments/{id}/status":
        "packages/functions/src/appointments/editAppointmentStatus.main",
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

      //Services
      //Patient Services
      "POST /services/add":
        "packages/functions/src/patientDashboard/services/addService.main",
      "GET /services":
        "packages/functions/src/patientDashboard/services/getServices.main",
      "DELETE /services/{id}":
        "packages/functions/src/patientDashboard/services/deleteService.main",

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

      // Patient History
      "GET /history/{id}":
        "packages/functions/src/patientDashboard/history/getPatientHistory.main",
      "PUT /history/{id}":
        "packages/functions/src/patientDashboard/history/editPatientHistory.main",
      "POST /history/add":
        "packages/functions/src/patientDashboard/history/addPatientHistory.main",

      // Patient Billing
      // Estimations
      "POST /billings/estimations/add":
        "packages/functions/src/patientDashboard/billings/estimation/addEstimation.main",
      "GET /billings/estimations":
        "packages/functions/src/patientDashboard/billings/estimation/getEstimations.main",
      "GET /billings/estimations/{id}":
        "packages/functions/src/patientDashboard/billings/estimation/getEstimationById.main",
      "PUT /billings/estimations/{id}":
        "packages/functions/src/patientDashboard/billings/estimation/editEstimation.main",
      "DELETE /billings/estimations/{id}":
        "packages/functions/src/patientDashboard/billings/estimation/deleteEstimation.main",
      // Billing
      "POST /billings/add":
        "packages/functions/src/patientDashboard/billings/addBilling.main",
      "GET /billings":
        "packages/functions/src/patientDashboard/billings/getBillings.main",
      "GET /billings/{id}":
        "packages/functions/src/patientDashboard/billings/getBillingById.main",
      "PUT /billings/{id}":
        "packages/functions/src/patientDashboard/billings/editBilling.main",
      "POST /billings/process":
        "packages/functions/src/patientDashboard/billings/processBilling.main",
      "POST /billings/refund":
        "packages/functions/src/patientDashboard/billings/refundBilling.main",
      "DELETE /billings/{id}":
        "packages/functions/src/patientDashboard/billings/deleteBilling.main",

      "GET /master/services/all":
        "packages/functions/src/patientDashboard/billings/getAllServices.main",
      // Patient Pharmacy
      "POST /pharmacy/add":
        "packages/functions/src/patientDashboard/pharmacy/addPharmacy.main",
      "GET /pharmacy/{patientId}":
        "packages/functions/src/patientDashboard/pharmacy/getPharmacy.main",
      "GET /pharmacy/patient/{id}":
        "packages/functions/src/patientDashboard/pharmacy/getPharmacyById.main",

      // Patient Dashboard End

      // Authenication
      "POST /auth/login": {
        function: "packages/functions/src/authentication/login.main",
        authorizer: "none",
      },
      "POST /auth/refresh-token": {
        function: "packages/functions/src/authentication/refreshToken.main",
        authorizer: "none",
      },

      // Admin Dev
      "GET /admin_dev/automate-medical-investigation":
        "packages/functions/src/admin_dev/automateMedicalInvestigation.main",
      "GET /admin_dev/automate-medical-procedure":
        "packages/functions/src/admin_dev/automateMedicalProcedure.main",
      "GET /admin_dev/automate-cryo-preservation":
        "packages/functions/src/admin_dev/automateMasterCryoPreservations.main",
      "GET /admin_dev/automate-treatment-cycle":
        "packages/functions/src/admin_dev/automateMasterTreatmentCycle.main",
      "GET /admin_dev/automate-master-services":
        "packages/functions/src/admin_dev/automateMasterServices.main",
    },
  });

  // Show the URLs in the output
  stack.addOutputs({
    ApiEndpoint: api.url,
  });

  return {
    api,
  };
}
