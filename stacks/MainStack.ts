import {
  Api,
  Queue,
  StackContext,
  Topic,
  Function,
  attachPermissionsToRole,
  Bucket,
} from 'sst/constructs';
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Duration } from 'aws-cdk-lib/core';
import { BlockPublicAccess, Bucket as S3Bucket } from 'aws-cdk-lib/aws-s3';
import { LayerVersion, Code } from 'aws-cdk-lib/aws-lambda';
import { SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';

export function MainStack({ stack }: StackContext) {
  // Create a default role for the API
  const role = new Role(stack, 'ApiRole', {
    assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    managedPolicies: [
      {
        managedPolicyArn:
          'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
      },
    ],
  });

  // Add policy to allow the role to create network interfaces in the VPC
  if (stack.stage === 'prod') {
    role.addToPolicy(
      new PolicyStatement({
        actions: [
          'ec2:CreateNetworkInterface',
          'ec2:DescribeNetworkInterfaces',
          'ec2:DeleteNetworkInterface',
        ],
        resources: ['*'],
      }),
    );
  }

  // Reference the VPC for the prod stage
  const vpc = Vpc.fromLookup(stack, 'VPC', {
    vpcId: 'vpc-0c8580ebee69ea0b4',
  });

  // Reference the security group for the prod stage
  const securityGroup = SecurityGroup.fromSecurityGroupId(
    stack,
    'SecurityGroup',
    'sg-039b91f80c8359e1a',
  );

  // Reference the MongoDB URI for the prod stage
  const mongodb_uri =
    stack.stage === 'prod' ? process.env.DB_PROD : process.env.DB_DEV;

  // Create a chromium layer for the pdf generation function
  const chromiumLayer = new LayerVersion(stack, 'ChromiumLayer', {
    code: Code.fromAsset('layers/chromium'),
    layerVersionName: `ChromiumLayer-${stack.stage}`,
  });

  attachPermissionsToRole(role as any, ['ssm']);

  const s3FileDeletionQueue = new Queue(stack, 'S3FileDeletionQueue', {
    consumer: {
      function: {
        vpc: stack.stage === 'prod' ? (vpc as any) : undefined,
        securityGroups:
          stack.stage === 'prod' ? [securityGroup as any] : undefined,
        handler: 'packages/functions/src/files/conditionalDelete.main',
        environment: {
          MONGO_URI: mongodb_uri as string,
        },
        timeout: 30,
        permissions: ['sqs', 's3'],
      },
    },
    cdk: {
      queue: {
        queueName: `S3FileDeletionQueue-${stack.stage}`,
        visibilityTimeout: Duration.seconds(45) as any,
      },
    },
  });

  const s3ScheduleDeletionFunction = new Function(
    stack,
    'S3ScheduleDeletionFunction',
    {
      handler: 'packages/functions/src/files/scheduleDelete.main',
      timeout: '30 seconds',
      vpc: stack.stage === 'prod' ? (vpc as any) : undefined,
      securityGroups:
        stack.stage === 'prod' ? [securityGroup as any] : undefined,
      permissions: ['sqs', 's3'],
      environment: {
        S3_SCHEDULE_DELETE_QUEUE_URL: s3FileDeletionQueue.queueUrl,
        MONGO_URI: mongodb_uri as string,
      },
    },
  );

  let userProfileBucket;
  if (stack.stage === 'prod') {
    userProfileBucket = new Bucket(stack, 'UserProfileBucketProd', {
      name: `evara-hms-user-profiles-${stack.stage}`,
      blockPublicACLs: false,
      cdk: {
        bucket: {
          bucketName: `evara-hms-user-profiles-${stack.stage}`,
        },
      },
    });
  } else {
    userProfileBucket = new Bucket(stack, 'UserProfileBucketDev', {
      cdk: {
        bucket: S3Bucket.fromBucketArn(
          stack,
          'UserProfileBucket',
          `arn:aws:s3:::evara-hms-user-profiles-devs`,
        ) as any,
      },
    });
  }

  let userIdentificationsBucket;
  if (stack.stage === 'prod') {
    userIdentificationsBucket = new Bucket(
      stack,
      'UseIdentificationsBucketProd',
      {
        name: `evara-hms-user-identifications-${stack.stage}`,
        cdk: {
          bucket: {
            bucketName: `evara-hms-user-identifications-${stack.stage}`,
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
            events: ['object_created'],
          },
        },
      },
    );
  } else {
    userIdentificationsBucket = new Bucket(
      stack,
      'UseIdentificationsBucketDev',
      {
        cdk: {
          bucket: S3Bucket.fromBucketArn(
            stack,
            'UserIdentificationsBucket',
            `arn:aws:s3:::evara-hms-user-identifications-devs`,
          ) as any,
        },
      },
    );
  }

  let userReportBucket;
  if (stack.stage === 'prod') {
    userReportBucket = new Bucket(stack, 'UserReportsBucketProd', {
      name: `evara-hms-user-reports-${stack.stage}`,
      blockPublicACLs: false,
      cdk: {
        bucket: {
          bucketName: `evara-hms-user-reports-${stack.stage}`,
        },
      },
      notifications: {
        ScheduleDeletion: {
          function: s3ScheduleDeletionFunction,
          events: ['object_created'],
        },
      },
    });
  } else {
    userReportBucket = new Bucket(stack, 'UserReportsBucketDev', {
      cdk: {
        bucket: S3Bucket.fromBucketArn(
          stack,
          'UserReportsBucket',
          `arn:aws:s3:::evara-hms-user-reports-devs`,
        ) as any,
      },
    });
  }

  let pharmacyInvoicesBucket;
  if (stack.stage === 'prod') {
    pharmacyInvoicesBucket = new Bucket(stack, 'PharmacyInvoicesBucketProd', {
      name: `evara-hms-pharmacy-invoices-${stack.stage}`,
      blockPublicACLs: false,

      cdk: {
        bucket: {
          bucketName: `evara-hms-pharmacy-invoices-${stack.stage}`,
        },
      },
      notifications: {
        ScheduleDeletion: {
          function: s3ScheduleDeletionFunction,
          events: ['object_created'],
        },
      },
    });
  } else {
    pharmacyInvoicesBucket = new Bucket(stack, 'PharmacyInvoicesBucketDev', {
      cdk: {
        bucket: S3Bucket.fromBucketArn(
          stack,
          'PharmacyInvoicesBucket',
          `arn:aws:s3:::evara-hms-pharmacy-invoices-devs`,
        ) as any,
      },
    });
  }

  const billingEstimationDLQ = new Queue(stack, 'BillingEstimationDLQ', {
    cdk: {
      queue: {
        queueName: `BillingEstimationDLQ-${stack.stage}`,
        visibilityTimeout: Duration.seconds(300) as any,
      },
    },
  });

  //Create a queue to handle SNS messages from topic "PatientBillingEstimation"
  const billingEstimationQueue = new Queue(stack, 'BillingEstimationQueue', {
    consumer: {
      function: {
        vpc: stack.stage === 'prod' ? (vpc as any) : undefined,
        securityGroups:
          stack.stage === 'prod' ? [securityGroup as any] : undefined,
        handler:
          'packages/functions/src/patientDashboard/billings/estimation/automateEstimation.main',
        environment: {
          MONGO_URI: mongodb_uri as string,
        },
        timeout: 300,
        role: role as any,
      },
    },
    cdk: {
      queue: {
        queueName: `BillingEstimationQueue-${stack.stage}`,
        visibilityTimeout: Duration.seconds(300) as any,
        deadLetterQueue: {
          maxReceiveCount: 3,
          queue: billingEstimationDLQ.cdk.queue,
        },
      },
    },
  });

  // Create a topic to add billing estimations for patients
  const billingEstimationTopic = new Topic(stack, 'BillingEstimationTopic', {
    subscribers: {
      subscriber: {
        type: 'queue',
        queue: billingEstimationQueue,
      },
    },
    cdk: {
      topic: {
        topicName: 'BillingEstimationTopic-' + stack.stage,
      },
    },
  });

  const serviceGenerationDLQ = new Queue(stack, 'ServiceGenerationDLQ', {
    cdk: {
      queue: {
        queueName: `ServiceGenerationDLQ-${stack.stage}`,
        visibilityTimeout: Duration.seconds(300) as any,
      },
    },
  });

  //Create a queue to handle SNS messages from topic "PatientBillingEstimation"
  const serviceGenerationQueue = new Queue(stack, 'ServiceGenerationQueue', {
    consumer: {
      function: {
        vpc: stack.stage === 'prod' ? (vpc as any) : undefined,
        securityGroups:
          stack.stage === 'prod' ? [securityGroup as any] : undefined,
        handler:
          'packages/functions/src/patientDashboard/billings/estimation/automateServiceGeneration.main',
        timeout: 300,
        environment: {
          MONGO_URI: mongodb_uri as string,
        },
        role: role as any,
      },
    },
    cdk: {
      queue: {
        queueName: `ServiceGenerationQueue-${stack.stage}`,
        visibilityTimeout: Duration.seconds(300) as any,
        deadLetterQueue: {
          maxReceiveCount: 3,
          queue: serviceGenerationDLQ.cdk.queue,
        },
      },
    },
  });

  // Create a topic to add billing estimations for patients
  const serviceGenerationTopic = new Topic(stack, 'ServiceGenerationTopic', {
    subscribers: {
      subscriber: {
        type: 'queue',
        queue: serviceGenerationQueue,
      },
    },
    cdk: {
      topic: {
        topicName: 'ServiceGenerationTopic-' + stack.stage,
      },
    },
  });

  // Create a dead letter queue for the report pdf generation queue
  const reportPdfGenerationDLQ = new Queue(stack, 'ReportPdfGenerationDLQ', {
    cdk: {
      queue: {
        queueName: `ReportPdfGenerationDLQ-${stack.stage}`,
        visibilityTimeout: Duration.seconds(300) as any,
      },
    },
  });

  const reportPdfGenerationQueue = new Queue(
    stack,
    'ReportPdfGenerationQueue',
    {
      consumer: {
        function: {
          vpc: stack.stage === 'prod' ? (vpc as any) : undefined,
          securityGroups:
            stack.stage === 'prod' ? [securityGroup as any] : undefined,
          handler: 'packages/functions/src/reports/pdfGenerator.main',
          timeout: 15,
          runtime: 'nodejs18.x',
          layers: [chromiumLayer as any],
          role: role as any,
          memorySize: '2 GB',
          nodejs: {
            esbuild: {
              external: ['@sparticuz/chromium'],
            },
          },
          permissions: ['sqs', 's3'],
          environment: {
            STAGE: stack.stage,
            MONGO_URI: mongodb_uri as string,
          },
        },
      },
      cdk: {
        queue: {
          queueName: `ReportPdfGenerationQueue-${stack.stage}`,
          visibilityTimeout: Duration.seconds(300) as any,
          deadLetterQueue: {
            maxReceiveCount: 3,
            queue: reportPdfGenerationDLQ.cdk.queue,
          },
        },
      },
    },
  );

  //Create a topic to handle SNS messages for generating reports html
  const reportHTMLGenerationTopic = new Topic(
    stack,
    'ReportHTMLGenerationTopic',
    {
      subscribers: {
        subscriber: {
          type: 'function',
          function: new Function(stack, 'ReportHTMLGenerationFunction', {
            vpc: stack.stage === 'prod' ? (vpc as any) : undefined,
            securityGroups:
              stack.stage === 'prod' ? [securityGroup as any] : undefined,
            handler: 'packages/functions/src/reports/htmlGenerator.main',
            timeout: '30 seconds',
            permissions: ['sqs'],
            copyFiles: [
              {
                from: 'packages/core/src/templates',
                // to: "templates",
              },
            ],
            environment: {
              USER_REPORT_BUCKET: userReportBucket.bucketName,
              REPORT_PDF_GENERATION_QUEUE_URL:
                reportPdfGenerationQueue.queueUrl,
              MONGO_URI: mongodb_uri as string,
            },
          }),
        },
      },
      cdk: {
        topic: {
          topicName: 'ReportHTMLGenerationTopic-' + stack.stage,
        },
      },
    },
  );

  /**
   * Represents the API configuration for the MainStack.
   */
  const api = new Api(stack, 'Api', {
    authorizers: {
      myAuthorizer: {
        type: 'lambda',
        function: new Function(stack, 'AuthorizerFunction', {
          vpc: stack.stage === 'prod' ? (vpc as any) : undefined,
          securityGroups:
            stack.stage === 'prod' ? [securityGroup as any] : undefined,
          handler: 'packages/functions/src/authentication/authorizer.main',
          permissions: ['secretsmanager'],
          timeout: '10 seconds',
          logFormat: 'JSON',
        }),
      },
    },

    defaults: {
      function: {
        vpc: stack.stage === 'prod' ? (vpc as any) : undefined,
        securityGroups:
          stack.stage === 'prod' ? [securityGroup as any] : undefined,
        timeout: '29 seconds',
        role: role as any,
        environment: {
          MONGO_URI: mongodb_uri as string,
          BILLING_ESTIMATION_TOPIC_ARN: billingEstimationTopic.topicArn,
          SERVICE_GENERATION_TOPIC_ARN: serviceGenerationTopic.topicArn,
          REPORT_HTML_GENERATION_TOPIC_ARN: reportHTMLGenerationTopic.topicArn,
          STAGE: stack.stage,
          REGION: stack.region,
        },
        permissions: ['sns', 'sqs', 'secretsmanager', 's3'],
        logFormat: 'JSON',
      },
      authorizer: 'myAuthorizer',
    },
    routes: {
      // Patients
      'POST /patients/{id}/partner/add':
        'packages/functions/src/patients/addPartner.main',
      'POST /patients/add': 'packages/functions/src/patients/addPatient.main',
      'GET /patients': 'packages/functions/src/patients/getPatients.main',
      'GET /patients/{id}':
        'packages/functions/src/patients/getPatientById.main',
      'PUT /patients/{id}': 'packages/functions/src/patients/editPatient.main',
      'DELETE /patients/{id}':
        'packages/functions/src/patients/deletePatient.main',

      // Appointments
      'POST /appointments/add':
        'packages/functions/src/appointments/addAppointment.main',
      'GET /appointments':
        'packages/functions/src/appointments/getAppointments.main',
      'GET /appointments/upcoming':
        'packages/functions/src/appointments/getUpcomingAppointments.main',
      'GET /appointments/{id}':
        'packages/functions/src/appointments/getAppointmentById.main',
      'PUT /appointments/{id}':
        'packages/functions/src/appointments/editAppointment.main',
      'PATCH /appointments/{id}/status':
        'packages/functions/src/appointments/editAppointmentStatus.main',
      'DELETE /appointments/{id}':
        'packages/functions/src/appointments/deleteAppointment.main',

      // Patient Dashboard End

      // Authenication
      'POST /auth/login': {
        function: 'packages/functions/src/authentication/login.main',
        authorizer: 'none',
      },
      'POST /auth/refresh-token': {
        function: 'packages/functions/src/authentication/refreshToken.main',
        authorizer: 'none',
      },

      //File Uploads
      'POST /files/get-signed-url':
        'packages/functions/src/files/generateSignedUrl.main',
      'DELETE /files/delete': 'packages/functions/src/files/deleteFile.main',

      // Home Summary
      'GET /home/summary': 'packages/functions/src/home/summary.main',
      'GET /home/patient-summary': 'packages/functions/src/home/patient.main',
      'GET /home/appointment-summary':
        'packages/functions/src/home/appointment.main',
      'GET /home/pharmacy-summary': 'packages/functions/src/home/pharmacy.main',

      // Admin Dev
      'GET /admin_dev/automate-medical-investigation':
        'packages/functions/src/admin_dev/automateMedicalInvestigation.main',
      'GET /admin_dev/automate-medical-procedure':
        'packages/functions/src/admin_dev/automateMedicalProcedure.main',
      'GET /admin_dev/automate-cryo-preservation':
        'packages/functions/src/admin_dev/automateMasterCryoPreservations.main',
      'GET /admin_dev/automate-treatment-cycle':
        'packages/functions/src/admin_dev/automateMasterTreatmentCycle.main',
      'GET /admin_dev/automate-master-services':
        'packages/functions/src/admin_dev/automateMasterServices.main',

      //Analytics Dashboard
      //Billings
      'GET /analytics/billings':
        'packages/functions/src/analyticsDashboard/billings/getAnalyticsPatientBillings.main',
      'GET /analytics/refundReports':
        'packages/functions/src/analyticsDashboard/billings/getRefundReports.main',
      'GET /analytics/billings/revenue-breakup':
        'packages/functions/src/analyticsDashboard/billings/getRevenueBreakup.main',

      //Pharmacy
      'GET /analytics/pharmacy/sales-by-schedule':
        'packages/functions/src/analyticsDashboard/pharmacy/getSalesBySchedule.main',
      'GET /analytics/pharmacy/drugs-and-vendor':
        'packages/functions/src/analyticsDashboard/pharmacy/getDrugsAndVendor.main',
      'GET /analytics/pharmacy/expiry-details':
        'packages/functions/src/analyticsDashboard/pharmacy/getExpiryDetails.main',
      'GET /analytics/pharmacy/internal-consumption':
        'packages/functions/src/analyticsDashboard/pharmacy/getInternalConsumption.main',
      'GET /analytics/pharmacy/stock-summary':
        'packages/functions/src/analyticsDashboard/pharmacy/getStockSummary.main',
      'GET /analytics/pharmacy/patient-return':
        'packages/functions/src/analyticsDashboard/pharmacy/getPatientReturn.main',
      'GET /analytics/pharmacy/critical-stocks':
        'packages/functions/src/analyticsDashboard/pharmacy/getCriticalStocks.main',
      'GET /analytics/pharmacy/pharmacy-report':
        'packages/functions/src/analyticsDashboard/pharmacy/getPharmacyReport.main',
      'GET /analytics/pharmacy/purchase-order-report':
        'packages/functions/src/analyticsDashboard/pharmacy/getPurchaseOrderReport.main',
    },
  });

  // Show the URLs in the output
  stack.addOutputs({
    ApiEndpoint: api.url,
    UserProfileBucket: userProfileBucket.bucketName,
    UserReportBucket: userReportBucket.bucketName,
    PharmacyInvoicesBucket: pharmacyInvoicesBucket.bucketName,
    userIdentificationsBucket: userIdentificationsBucket.bucketName,
    StackName: stack.stackName,
  });

  return {
    api,
    pharmacyInvoicesBucket,
  };
}
