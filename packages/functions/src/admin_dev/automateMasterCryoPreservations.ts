import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "../../../core/src/lib/utils/errorResponse";
import successResponse from "../../../core/src/lib/utils/successResponse";
import { connectMongoDb } from "../../../core/src/lib/db/mongodb";
import CryoPreservations from "../../../core/src/models/cryoPreservation/CryoPreservations";
import MasterCryoPreservations from "../../../core/src/models/cryoPreservation/MasterCryoPreservations";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    // Connect to MongoDB
    await connectMongoDb();

    const CryoPreservation = await CryoPreservations.find();

    const cryoPreservations = await Promise.all(
      CryoPreservation.map(async (cryoPreservation) => {
        const investigation = new MasterCryoPreservations({
          cryoPreservation: cryoPreservation._id,
          cryoPreservationType: cryoPreservation.cryoPreservationType,
          name: cryoPreservation.cryoPreservationName,
          gender: cryoPreservation.gender,
          description: cryoPreservation.description,
          cost: Math.floor(Math.random() * (30000 - 10000) + 500),
          active: true,
        });

        return await investigation.save();
      })
    );

    // Return success response with all created cryoPreservations
    return successResponse(
      `${cryoPreservations.length} CryoPreservations created successfully`,
      cryoPreservations
    );
  } catch (error) {
    // Handle any errors that occur during the operation
    return errorResponse(error);
  }
};
