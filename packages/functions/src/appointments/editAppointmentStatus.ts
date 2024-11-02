import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import Appointments from '@evara-backend/core/src/models/Appointments';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import mongoose from 'mongoose';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';

/**
 * Handler to update the status of an appointment.
 */
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    // Connect to MongoDB
    await connectMongoDb();

    if (!event.pathParameters) {
      throw new ErrorMessage(400, 'Path parameters are required');
    }

    if (!event.body) {
      throw new ErrorMessage(400, 'Request body is required');
    }

    const { id } = event.pathParameters || {};
    const { status, reportedTime } = JSON.parse(event.body);

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new ErrorMessage(400, 'Invalid appointment ID provided');
    }

    if (!status) {
      throw new ErrorMessage(400, 'Status is required');
    }

    // Validate the status (example validation, adjust according to your business logic)
    const validStatuses = ['Scheduled', 'Reported', 'Cancelled', 'Completed'];
    if (!validStatuses.includes(status)) {
      throw new ErrorMessage(400, 'Invalid status provided');
    }

    if (status === 'Reported' && !reportedTime) {
      throw new ErrorMessage(400, 'Reported time is required');
    }

    const update: any = {};
    if (status === 'Reported') {
      update.reportedTime = reportedTime;
      update.status = status;
    } else {
      update.status = status;
    }

    // Update the appointment status in the database
    const updatedAppointment = await Appointments.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true },
    );

    if (!updatedAppointment) {
      throw new ErrorMessage(404, 'Appointment not found');
    }

    // Return the updated appointment
    return successResponse(
      'Appointment status updated successfully',
      updatedAppointment,
    );
  } catch (error) {
    return errorResponse(error);
  }
};
