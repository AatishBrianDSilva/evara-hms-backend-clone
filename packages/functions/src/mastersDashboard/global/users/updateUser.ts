import { APIGatewayProxyHandler } from 'aws-lambda';
import bcrypt from 'bcryptjs';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import { EUserRole, User } from '@evara-backend/core/src/models/User';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/src/lib/utils/extractAuthorizerDetails';
import Doctors, {
  DoctorSpeciality,
} from '@evara-backend/core/models/mastersDashboard/Doctors';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb();
    const auth = extractAuthorizerDetails(event);
    if (!auth) {
      throw new ErrorMessage(401, 'Unauthorized');
    }

    if (event.body == null) {
      throw new ErrorMessage(400, 'Update data is required');
    }

    // 1. Parse the request body
    const data = JSON.parse(event.body);

    // 2. Validate required fields
    if (!data.userId) {
      throw new ErrorMessage(400, 'User ID is required');
    }

    // 3. Prepare update fields for User model
    const updateFields: Partial<{
      username: string;
      email: string;
      role: EUserRole;
      phone: string;
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

    if (data.phone) {
      updateFields.phone = data.phone;
    }

    // 4. Update the user
    const updatedUser = await User.findByIdAndUpdate(
      data.userId,
      updateFields,
      {
        new: true,
        runValidators: true,
      },
    );

    if (!updatedUser) {
      throw new ErrorMessage(404, 'User not found or not updated');
    }

    // -------------------------------------------
    // 5. Synchronize with Doctors collection
    // -------------------------------------------

    // (A) If the new role is 'doctor' or 'embryologist'
    if (
      updatedUser.role === EUserRole.Doctor ||
      updatedUser.role === EUserRole.Embryologist
    ) {
      // 5a. Determine doctor speciality
      const speciality =
        updatedUser.role === EUserRole.Embryologist
          ? DoctorSpeciality.Embryologist
          : data.speciality || DoctorSpeciality.General;

      // 5b. Check if a doctor doc already exists
      let doctorDoc = await Doctors.findOne({ userId: updatedUser._id });

      // 5c. Create new doctor doc if none exists
      if (!doctorDoc) {
        doctorDoc = await Doctors.create({
          userId: updatedUser._id,
          clinicId: updatedUser.clinicId, // or data.clinicId
          branchId: updatedUser.branchId, // or data.branchId
          firstName: data.firstName || updatedUser.username,
          lastName: data.lastName || '',
          gender: data.gender || 'male', // adapt as needed
          email: updatedUser.email,
          mobile: updatedUser.phone,
          speciality,
        });
      } else {
        // 5d. Update existing doctor doc if needed
        doctorDoc.firstName = data.firstName ?? doctorDoc.firstName;
        doctorDoc.lastName = data.lastName ?? doctorDoc.lastName;
        doctorDoc.gender = data.gender ?? doctorDoc.gender;
        doctorDoc.email = updatedUser.email;
        doctorDoc.mobile = updatedUser.phone;
        doctorDoc.speciality = speciality;
        // any other fields you want to sync...
        await doctorDoc.save();
      }
    }
    // (B) If the new role is NOT 'doctor' or 'embryologist'
    else {
      // 5e. Optionally remove or mark the existing doctor doc as inactive
      const doctorDoc = await Doctors.findOne({ userId: updatedUser._id });
      if (doctorDoc) {
        doctorDoc.status = 'inactive';
        doctorDoc.deletedAt = new Date();
        await doctorDoc.save();
      }
    }

    // 6. Build and return the final response
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
