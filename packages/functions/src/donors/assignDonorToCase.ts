import { APIGatewayProxyHandler } from 'aws-lambda';

import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import Donor from '@evara-backend/core/models/mastersDashboard/local/Donor';
import Case from '@evara-backend/core/models/Cases';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/src/lib/utils/extractAuthorizerDetails';
import Patient from '@evara-backend/core/src/models/Patients';
import Cases from '@evara-backend/core/models/Cases';

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const mongoose = await connectMongoDb();
  const session = await mongoose.startSession();
  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, 'Unauthorized');
    }

    session.startTransaction();

    if (event.body == null) {
      throw new ErrorMessage(400, "Patient's data is required");
    }

    const { donorId, caseId } = JSON.parse(event.body);

    // Check if the donor is already assigned to a case
    const donorAlreadyAssigned = await Cases.findOne({
      donorId: donorId,
    }).session(session);
    if (donorAlreadyAssigned) {
      throw new ErrorMessage(404, 'Donor Already assigned');
    }

    // Check if case exists
    const ivfCase = await Case.findOne({ caseId }).session(session);
    if (!ivfCase) {
      throw new ErrorMessage(404, 'Case not found');
    }

    // Check if the donor exists
    const donor = await Donor.findOne({ donorId }).session(session);
    if (!donor) {
      throw new ErrorMessage(404, 'Donor not found');
    }

    donor.caseId = caseId;
    // Update the donor
    await donor.save({ session });

    // Update the case
    ivfCase.donorId = donorId;
    await ivfCase.save({ session });

    // Return success response
    session.commitTransaction();
    return successResponse('Donor added successfully');
  } catch (error) {
    // Rollback the transaction
    session.abortTransaction();
    return errorResponse(error);
  } finally {
    // End the session
    session.endSession();
  }
};
