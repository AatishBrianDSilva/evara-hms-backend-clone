import { APIGatewayProxyHandler } from 'aws-lambda';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import DefaultService from '@evara-backend/core/src/models/patientDashboard/services/DefaultService';
import MasterService from '@evara-backend/core/src/models/patientDashboard/services/MasterService';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    // Connect to MongoDB
    await connectMongoDb();

    // Fetch all medical procedures
    const DefaultServices = await DefaultService.find();

    // Create a Master Procedures for each medical test
    const services = await Promise.all(
      DefaultServices.map(async service => {
        const newservice = new MasterService({
          service: service._id,
          name: service.name,
          serviceType: service.serviceType,
          description: service.description,
          cost: Math.floor(Math.random() * (4000 - 500) + 200), // Random cost between 200 and 2000
          active: true,
        });

        return await newservice.save();
      }),
    );

    // Return success response with all created Procedures
    return successResponse(
      `${services.length} Procedures created successfully`,
      services,
    );
  } catch (error) {
    // Handle any errors that occur during the operation
    return errorResponse(error);
  }
};
