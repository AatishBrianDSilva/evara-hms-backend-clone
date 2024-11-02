import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import { extractAuthorizerDetails } from '@evara-backend/core/src/lib/utils/extractAuthorizerDetails';
import { APIGatewayProxyHandler } from 'aws-lambda';
import { IDateRange } from './summary';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import Appointments from '@evara-backend/core/src/models/Appointments';
import Doctors from '@evara-backend/core/src/models/mastersDashboard/Doctors';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, 'Unauthorized');
    }
    // Connect to MongoDB
    await connectMongoDb();

    // Extract query string parameters
    const params = event.queryStringParameters || {};
    const { startDate, endDate } = params;
    // console.log("New Params", params);

    const dateRange: IDateRange = {
      startDate: new Date(),
      endDate: new Date(),
    };

    if (startDate) {
      dateRange.startDate = new Date(startDate);
    }
    if (endDate) {
      dateRange.endDate = new Date(endDate);
    }

    const upcomingAppointments = await Appointments.find({
      clinicId: auth.clinicId,
      branchId: auth.branchId,
      date: {
        $gte: dateRange.startDate,
        $lte: dateRange.endDate,
      },
      status: { $in: ['Scheduled', 'Reported'] },
    }).populate({
      path: 'doctorId',
      select: 'firstName lastName desgination',
      model: Doctors.modelName,
    });

    return successResponse('Success', upcomingAppointments);
  } catch (error) {
    return errorResponse(error);
  }
};
