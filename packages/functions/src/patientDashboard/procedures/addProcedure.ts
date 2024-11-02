import { APIGatewayProxyHandler } from 'aws-lambda';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import PatientProcedures from '@evara-backend/core/src/models/patientDashboard/procedure/PatientProcedure';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import MasterProcedure from '@evara-backend/core/src/models/patientDashboard/procedure/MasterProcedure';
import { EPatientBillingServiceType } from '@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling';
import { publishBillingServiceToSNS } from '@evara-backend/core/src/lib/utils/publishBillingServiceToSNS';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;
  const auth = extractAuthorizerDetails(event);

  try {
    // Connect to MongoDB
    await connectMongoDb();

    if (event.body == null) {
      throw new ErrorMessage(400, 'Data is required');
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    // TODO: Remove clinicId and branchId after adding authentication
    data.clinicId = auth.clinicId;
    data.branchId = auth.branchId;

    console.log('Data: ', data);

    for (let i = 0; i < data.length; i++) {
      data[i].clinicId = auth.clinicId;
      data[i].branchId = auth.branchId;
      const procedure = new PatientProcedures(data[i]);
      const newProcedure = await procedure.save();

      const masterProcedure = await MasterProcedure.findById(
        newProcedure.procedure,
      ).lean();

      if (masterProcedure) {
        const serviceName = masterProcedure.name;

        // Publish to SNS
        await publishBillingServiceToSNS(
          newProcedure.patientCode,
          newProcedure.doctor,
          newProcedure.procedure,
          newProcedure._id as any,
          EPatientBillingServiceType.Procedure,
          serviceName,
          masterProcedure.cost,
          1,
          auth.clinicId,
          auth.branchId,
        );
      } else {
        console.error('Master Procedure not found');
      }
    }

    // Return success response
    return successResponse('Procedure created successfully');
  } catch (error) {
    return errorResponse(error);
  }
};
