import {
  Api,
  Queue,
  StackContext,
  Topic,
  Function,
  attachPermissionsToRole,
  Bucket,
} from "sst/constructs";
import { Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Duration } from "aws-cdk-lib/core";
import { BlockPublicAccess } from "aws-cdk-lib/aws-s3";
import { LayerVersion, Code } from "aws-cdk-lib/aws-lambda";

export function MainStack({ stack }: StackContext) {
  // Create a default role for the API
  const role = new Role(stack, "ApiRole", {
    assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
    managedPolicies: [
      {
        managedPolicyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
      },
    ],
  });

  // Create a chromium layer for the pdf generation function
  const chromiumLayer = new LayerVersion(stack, "ChromiumLayer", {
    code: Code.fromAsset("layers/chromium"),
    layerVersionName: `ChromiumLayer-${stack.stage}`,
  });

  attachPermissionsToRole(role, ["ssm"]);

  const s3FileDeletionQueue = new Queue(stack, "S3FileDeletionQueue", {
    consumer: {
      function: {
        handler: "packages/functions/src/files/conditionalDelete.main",
        timeout: 30,
        permissions: ["sqs", "s3"],
      },
    },
    cdk: {
      queue: {
        queueName: `S3FileDeletionQueue-${stack.stage}`,
        visibilityTimeout: Duration.seconds(45),
      },
    },
  });

  const s3ScheduleDeletionFunction = new Function(stack, "S3ScheduleDeletionFunction", {
    handler: "packages/functions/src/files/scheduleDelete.main",
    timeout: "30 seconds",
    permissions: ["sqs", "s3"],
    environment: {
      S3_SCHEDULE_DELETE_QUEUE_URL: s3FileDeletionQueue.queueUrl,
    },
  });

  const userProfileBucket = new Bucket(stack, "UserProfilesBucket", {
    name: `gv-evara-hms-user-profiles-${stack.stage}`,
    cdk: {
      bucket: {
        bucketName: `gv-evara-hms-user-profiles-${stack.stage}`,
        blockPublicAccess: new BlockPublicAccess({
          blockPublicPolicy: false,
          ignorePublicAcls: false,
          restrictPublicBuckets: false,
          blockPublicAcls: false,
        }),
      },
    },
    notifications: {
      ScheduleDeletion: {
        function: s3ScheduleDeletionFunction,
        events: ["object_created"],
      },
    },
  });

  const userReportBucket = new Bucket(stack, "UserReportsBucket", {
    name: `gv-evara-hms-user-reports-${stack.stage}`,
    blockPublicACLs: false,

    cdk: {
      bucket: {
        bucketName: `gv-evara-hms-user-reports-${stack.stage}`,
      },
    },
    notifications: {
      ScheduleDeletion: {
        function: s3ScheduleDeletionFunction,
        events: ["object_created"],
      },
    },
  });

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

  // Create a dead letter queue for the report pdf generation queue
  const reportPdfGenerationDLQ = new Queue(stack, "ReportPdfGenerationDLQ", {
    cdk: {
      queue: {
        queueName: `ReportPdfGenerationDLQ-${stack.stage}`,
        visibilityTimeout: Duration.seconds(300),
      },
    },
  });

  const reportPdfGenerationQueue = new Queue(stack, "ReportPdfGenerationQueue", {
    consumer: {
      function: {
        handler: "packages/functions/src/reports/pdfGenerator.main",
        timeout: 15,
        runtime: "nodejs18.x",
        layers: [chromiumLayer],
        role: role,
        memorySize: "2 GB",
        nodejs: {
          esbuild: {
            external: ["@sparticuz/chromium"],
          },
        },
        permissions: ["sqs", "s3"],
        environment: {
          STAGE: stack.stage,
        },
      },
    },
    cdk: {
      queue: {
        queueName: `ReportPdfGenerationQueue-${stack.stage}`,
        visibilityTimeout: Duration.seconds(300),
        deadLetterQueue: {
          maxReceiveCount: 3,
          queue: reportPdfGenerationDLQ.cdk.queue,
        },
      },
    },
  });

  //Create a topic to handle SNS messages for generating reports html
  const reportHTMLGenerationTopic = new Topic(stack, "ReportHTMLGenerationTopic", {
    subscribers: {
      subscriber: {
        type: "function",
        function: new Function(stack, "ReportHTMLGenerationFunction", {
          handler: "packages/functions/src/reports/htmlGenerator.main",
          timeout: "30 seconds",
          permissions: ["sqs"],
          copyFiles: [
            {
              from: "packages/core/src/templates",
              // to: "templates",
            },
          ],
          environment: {
            USER_REPORT_BUCKET: userReportBucket.bucketName,
            REPORT_PDF_GENERATION_QUEUE_URL: reportPdfGenerationQueue.queueUrl,
          },
        }),
      },
    },
    cdk: {
      topic: {
        topicName: "ReportHTMLGenerationTopic-" + stack.stage,
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
          logFormat: "JSON",
        }),
      },
    },
    defaults: {
      function: {
        timeout: "29 seconds",
        role: role,
        environment: {
          BILLING_ESTIMATION_TOPIC_ARN: billingEstimationTopic.topicArn,
          REPORT_HTML_GENERATION_TOPIC_ARN: reportHTMLGenerationTopic.topicArn,
          STAGE: stack.stage,
          REGION: stack.region,
        },
        permissions: ["sns", "sqs", "secretsmanager", "s3"],
        logFormat: "JSON",
      },
      authorizer: "myAuthorizer",
    },
    routes: {
      // Patients
      "POST /patients/{id}/partner/add": "packages/functions/src/patients/addPartner.main",
      "POST /patients/add": "packages/functions/src/patients/addPatient.main",
      "GET /patients": "packages/functions/src/patients/getPatients.main",
      "GET /patients/{id}": "packages/functions/src/patients/getPatientById.main",
      "PUT /patients/{id}": "packages/functions/src/patients/editPatient.main",
      "DELETE /patients/{id}": "packages/functions/src/patients/deletePatient.main",

      // Appointments
      "POST /appointments/add": "packages/functions/src/appointments/addAppointment.main",
      "GET /appointments": "packages/functions/src/appointments/getAppointments.main",
      "GET /appointments/upcoming":
        "packages/functions/src/appointments/getUpcomingAppointments.main",
      "GET /appointments/{id}": "packages/functions/src/appointments/getAppointmentById.main",
      "PUT /appointments/{id}": "packages/functions/src/appointments/editAppointment.main",
      "PATCH /appointments/{id}/status":
        "packages/functions/src/appointments/editAppointmentStatus.main",
      "DELETE /appointments/{id}": "packages/functions/src/appointments/deleteAppointment.main",

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
      "POST /services/add": "packages/functions/src/patientDashboard/services/addService.main",
      "GET /services": "packages/functions/src/patientDashboard/services/getServices.main",
      "DELETE /services/{id}":
        "packages/functions/src/patientDashboard/services/deleteService.main",

      //PROCEDURES
      //Patient Procedures
      "POST /procedures/add":
        "packages/functions/src/patientDashboard/procedures/addProcedure.main",
      "GET /procedures": "packages/functions/src/patientDashboard/procedures/getProcedures.main",
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
      "GET /history/{id}": "packages/functions/src/patientDashboard/history/getPatientHistory.main",
      "PUT /history/{id}":
        "packages/functions/src/patientDashboard/history/editPatientHistory.main",
      "POST /history/add": "packages/functions/src/patientDashboard/history/addPatientHistory.main",

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
      "POST /billings/add": "packages/functions/src/patientDashboard/billings/addBilling.main",
      "GET /billings": "packages/functions/src/patientDashboard/billings/getBillings.main",
      "GET /billings/{id}": "packages/functions/src/patientDashboard/billings/getBillingById.main",
      "PUT /billings/{id}": "packages/functions/src/patientDashboard/billings/editBilling.main",
      "POST /billings/process":
        "packages/functions/src/patientDashboard/billings/processBilling.main",
      "POST /billings/refund":
        "packages/functions/src/patientDashboard/billings/refundBilling.main",
      "DELETE /billings/{id}":
        "packages/functions/src/patientDashboard/billings/deleteBilling.main",

      "GET /master/services/all":
        "packages/functions/src/patientDashboard/billings/getAllServices.main",
      // Patient Pharmacy
      "POST /pharmacy/add": "packages/functions/src/patientDashboard/pharmacy/addPharmacy.main",
      "GET /pharmacy/{patientId}":
        "packages/functions/src/patientDashboard/pharmacy/getPharmacy.main",
      "GET /pharmacy/patient/{id}":
        "packages/functions/src/patientDashboard/pharmacy/getPharmacyById.main",

      // Patient Notes
      "POST /notes/add": "packages/functions/src/patientDashboard/notes/add.main",
      "GET /notes": "packages/functions/src/patientDashboard/notes/getAll.main",
      "GET /notes/{id}": "packages/functions/src/patientDashboard/notes/get.main",
      "PUT /notes/{id}": "packages/functions/src/patientDashboard/notes/edit.main",
      "DELETE /notes/{id}": "packages/functions/src/patientDashboard/notes/delete.main",

      // Patient Reports
      "GET /reports/patient/{id}": "packages/functions/src/reports/getPatientReports.main",
      "GET /reports/download/{id}": "packages/functions/src/reports/downloadReport.main",
      "GET /reports": "packages/functions/src/patientDashboard/reports/getPatientReports.main",

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

      //File Uploads
      "POST /files/get-signed-url": "packages/functions/src/files/generateSignedUrl.main",
      "DELETE /files/delete": "packages/functions/src/files/deleteFile.main",

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
    UserProfileBucket: userProfileBucket.bucketName,
    UserReportBucket: userReportBucket.bucketName,
    StackName: stack.stackName,
  });

  return {
    api,
  };
}
