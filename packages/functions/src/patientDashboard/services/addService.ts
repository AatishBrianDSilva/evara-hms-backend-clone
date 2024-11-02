import { APIGatewayProxyHandler } from 'aws-lambda';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import PatientService from '@evara-backend/core/src/models/patientDashboard/services/PatientService';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import MasterService from '@evara-backend/core/src/models/patientDashboard/services/MasterService';
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
      const service = new PatientService(data[i]);
      const newService = await service.save();

      const masterService = await MasterService.findById(
        newService.service,
      ).lean();

      if (masterService) {
        const serviceName = masterService.name;

        // Publish to SNS
        await publishBillingServiceToSNS(
          newService.patientCode,
          newService.doctor,
          newService.service,
          newService._id as any,
          EPatientBillingServiceType.Service,
          serviceName,
          masterService.cost,
          1,
          auth.clinicId,
          auth.branchId,
        );
      } else {
        console.error('Master Service not found');
      }
    }

    // Return success response
    return successResponse('service(s) created successfully');
  } catch (error) {
    return errorResponse(error);
  }
};
