import { APIGatewayProxyHandler } from 'aws-lambda';

import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';

import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import PatientInvestigation from '@evara-backend/core/src/models/patientDashboard/investigation/PatientInvestigation';
import Doctors from '@evara-backend/core/src/models/mastersDashboard/Doctors';
import MasterInvestigation from '@evara-backend/core/src/models/patientDashboard/investigation/MasterInvestigations';
import MedicalTest from '@evara-backend/core/src/models/patientDashboard/investigation/MedicalTests';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb();

    if (event.pathParameters === null) {
      throw new ErrorMessage(400, 'Path parameters are null');
    }

    // Safely access the id property
    const id = event.pathParameters['id'];
    if (!id) {
      throw new ErrorMessage(400, 'Id is not provided');
    }

    const investigation = await PatientInvestigation.findById(id)
      .populate([
        {
          path: 'doctor',
          select: 'firstName lastName desgination',
          model: Doctors.modelName,
        },
        {
          path: 'investigation',
          model: MasterInvestigation.modelName,
          populate: {
            path: 'test',
            model: MedicalTest.modelName,
          },
        },
      ])
      .lean();

    if (!investigation) {
      throw new ErrorMessage(404, 'Investigation not found');
    }

    return successResponse('Investigation fetched successfully', investigation);
  } catch (error) {
    return errorResponse(error);
  }
};
