import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import {
  EPatientBillingEstimationStatus,
  PatientBillingEstimation,
} from '@evara-backend/core/models/patientDashboard/Billings/PatientBillingEstimation';
import {
  EPatientBillingStatus,
  PatientBilling,
} from '@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling';
import { extractAuthorizerDetails } from '@evara-backend/core/src/lib/utils/extractAuthorizerDetails';
import SNSService from '@evara-backend/core/src/lib/aws/sns';
import Patient from '@evara-backend/core/src/models/Patients';
import Cases from '@evara-backend/core/src/models/Cases';

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const auth = extractAuthorizerDetails(event);
  const conn = await connectMongoDb();
  const session = await conn.startSession();
  session.startTransaction();

  try {
    if (event.body == null) {
      throw new ErrorMessage(400, 'Data is required');
    }

    const { estimations } = JSON.parse(event.body);
    const clinicId = auth?.clinicId;
    const branchId = auth?.branchId;
    const createdBy = auth?.username;

    const estimationGroups = new Map();

    // Group estimations by service type
    for (const estimationId of estimations) {
      const estimation =
        await PatientBillingEstimation.findById(estimationId).lean();

      if (!estimation) {
        throw new ErrorMessage(404, 'Estimation not found');
      }

      const serviceType = estimation.serviceType;
      if (!estimationGroups.has(serviceType)) {
        estimationGroups.set(serviceType, []);
      }

      estimationGroups.get(serviceType).push(estimation);
    }

    const patientCode = estimationGroups.values().next().value[0].patientCode;
    const automateServiceGeneration = [];

    for (const [serviceType, estimations] of estimationGroups.entries()) {
      let amount = 0;
      let discount = 0;
      let tax = 0;
      const items = [];

      for (const estimation of estimations) {
        amount += parseFloat(estimation.estimatedPrice.toFixed(2));
        tax += parseFloat(estimation?.estimatedTax?.toFixed(2)) || 0;

        const newItem: any = {
          estimationId: estimation._id,
          masterServiceId: estimation.masterServiceId,
          doctorId: estimation.doctorId,
          serviceId: estimation.serviceId || undefined,
          serviceName: estimation.serviceName,
          serviceType: estimation.serviceType,
          quantity: estimation.quantity,
          mrpPerUnit: estimation.estimatedUnitPrice,
          price: estimation.cost,
          discount: 0,
          tax: estimation.estimatedTax,
          taxRate: estimation.taxRate,
          total: estimation.estimatedTotal,
        };

        items.push(newItem);

        if (!estimation.serviceId) {
          automateServiceGeneration.push({
            masterServiceId: estimation.masterServiceId,
            serviceType: estimation.serviceType,
            doctorId: estimation.doctorId,
            quantity: estimation.quantity,
          });
        }
      }

      // Create a new billing document
      const newBilling = new PatientBilling({
        clinicId,
        branchId,
        patientCode,
        billType: serviceType,
        createdBy,
        items,
        amount,
        discount,
        tax,
        status: EPatientBillingStatus.Pending,
      });

      await newBilling.save({ session: session });

      await Promise.all(
        estimations.map((estimation: any) =>
          PatientBillingEstimation.findByIdAndUpdate(
            estimation._id,
            { status: EPatientBillingEstimationStatus.Inactive },
            { session: session },
          ),
        ),
      );
    }

    console.log('Automate service generation', automateServiceGeneration);

    const patient = await Patient.findOne({ patientId: patientCode }).lean();
    const cases = await Cases.findOne({ patientId: patient?.patientId });

    for (const data of automateServiceGeneration) {
      await SNSService.publishMessage({
        TopicArn: process.env.SERVICE_GENERATION_TOPIC_ARN as string,
        Message: JSON.stringify({
          clinicId: auth?.clinicId,
          branchId: auth?.branchId,
          patientId: patient?._id,
          patientCode: patient?.patientId,
          caseId: cases?.caseId,
          masterServiceId: data.masterServiceId,
          serviceType: data.serviceType,
          doctorId: data.doctorId,
          quantity: data.quantity,
        }),
      });
    }

    await session.commitTransaction();
    return successResponse('Billing generated successfully');
  } catch (error) {
    await session.abortTransaction();
    return errorResponse(error);
  } finally {
    session.endSession();
  }
};
