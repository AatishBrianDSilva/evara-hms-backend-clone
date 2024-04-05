import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import DefaultTreatmentCycle from "@evara-backend/core/src/models/treatmentCycle/DefaultTreatmentCycle";
import MasterTreatmentCycle from "@evara-backend/core/src/models/treatmentCycle/MasterTreatmentCycle";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    // Connect to MongoDB
    await connectMongoDb();

    const defaultTreatmentCycles = await DefaultTreatmentCycle.find().lean();

    const treatmentCycles = await Promise.all(
      defaultTreatmentCycles.map(async (defaultTreatmentCycle) => {
        const masterTreatmentCycle = new MasterTreatmentCycle({
          treatmentCycle: defaultTreatmentCycle._id,
          cycleType: defaultTreatmentCycle.cycleType,
          name: defaultTreatmentCycle.cycleName,
          gender: defaultTreatmentCycle.gender,
          description: defaultTreatmentCycle.description,
          cost: Math.floor(Math.random() * (500000 - 100000) + 500),
          active: true,
        });

        return await masterTreatmentCycle.save();
      })
    );

    // Return success response with all created treatmentCycles
    return successResponse(
      `${treatmentCycles.length} TreatmentCycles created successfully`,
      treatmentCycles
    );
  } catch (error) {
    // Handle any errors that occur during the operation
    return errorResponse(error);
  }
};
