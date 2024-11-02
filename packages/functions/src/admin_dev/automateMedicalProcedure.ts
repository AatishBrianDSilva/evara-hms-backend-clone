import { APIGatewayProxyHandler } from 'aws-lambda';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import MasterProcedure from '@evara-backend/core/models/patientDashboard/procedure/MasterProcedure';
import MedicalProcedure from '@evara-backend/core/models/patientDashboard/procedure/MedicalProcedure'; // Ensure this import path matches your project structure
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    // Connect to MongoDB
    await connectMongoDb();

    // Fetch all medical procedures
    const MedicalProceduress = await MedicalProcedure.find();

    // Create a Master Procedures for each medical test
    const procedures = await Promise.all(
      MedicalProceduress.map(async procedure => {
        const investigation = new MasterProcedure({
          procedure: procedure._id,
          name: procedure.procedureName,
          procedureType: procedure.procedureType,
          gender: procedure.gender,
          description: procedure.description,
          cost: Math.floor(Math.random() * (4000 - 500) + 200), // Random cost between 200 and 2000
          active: true,
        });

        return await investigation.save();
      }),
    );

    // Return success response with all created Procedures
    return successResponse(
      `${procedures.length} Procedures created successfully`,
      procedures,
    );
  } catch (error) {
    // Handle any errors that occur during the operation
    return errorResponse(error);
  }
};
