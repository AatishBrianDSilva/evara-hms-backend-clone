import { APIGatewayProxyHandler } from 'aws-lambda';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import mongoose from 'mongoose';
import Appointments from '@evara-backend/core/src/models/Appointments';

interface IFilter {
  status: string;
  date: { $gte: Date };
  doctorId?: mongoose.Types.ObjectId;
}

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    // Connect to MongoDB
    await connectMongoDb();

    const doctorId = event.queryStringParameters?.doctorId;
    const date = event.queryStringParameters?.date || '';

    const filters: IFilter = {
      status: 'Scheduled',
      date: { $gte: date ? new Date(date) : new Date() },
    };

    if (doctorId) {
      filters['doctorId'] = new mongoose.Types.ObjectId(doctorId);
    }

    console.log('Filters:', filters);

    const appointments = await Appointments.find(filters).lean();

    return successResponse('Success', appointments);
  } catch (error) {
    return errorResponse(error);
  }
};
