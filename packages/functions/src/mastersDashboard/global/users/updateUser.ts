import { APIGatewayProxyHandler } from 'aws-lambda';
import bcrypt from 'bcryptjs';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import { User } from '@evara-backend/core/src/models/User';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/src/lib/utils/extractAuthorizerDetails';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb();
    // Connect to MongoDB
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, 'Unauthorized');
    }

    if (event.body == null) {
      throw new ErrorMessage(400, 'Update data is required');
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    // Validate required fields
    if (!data.userId) {
      throw new ErrorMessage(400, 'User ID is required');
    }

    const updateFields: Partial<{
      username: string;
      email: string;
      role: string;
    }> = {};

    if (data.username) {
      const existingUser = await User.findOne({ username: data.username });
      if (existingUser && existingUser._id.toString() !== data.userId) {
        throw new ErrorMessage(409, 'Username already exists');
      }
      updateFields.username = data.username;
    }

    if (data.email) {
      const existingUser = await User.findOne({ email: data.email });
      if (existingUser && existingUser._id.toString() !== data.userId) {
        throw new ErrorMessage(409, 'Email already exists');
      }
      updateFields.email = data.email;
    }

    if (data.role) {
      updateFields.role = data.role;
    }

    const updatedUser = await User.findByIdAndUpdate(
      data.userId,
      updateFields,
      {
        new: true,
        runValidators: true,
      },
    );

    if (!updatedUser) {
      throw new ErrorMessage(404, 'Data not updated');
    }

    const responseData = {
      userId: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      role: updatedUser.role,
      phone: updatedUser.phone,
    };

    return successResponse('User updated successfully', responseData);
  } catch (error) {
    return errorResponse(error);
  }
};
