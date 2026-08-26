import { APIGatewayProxyHandler } from 'aws-lambda';

import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import Patients from '@evara-backend/core/models/Patients';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import Cases from '@evara-backend/core/models/Cases';
import {
  S3KeepPermanently,
  parseS3Url,
  keepUrlsPermanently,
} from 'src/files/_KeepPermanently';

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const mongoose = await connectMongoDb();
  const session = await mongoose.startSession();
  try {
    // Connect to MongoDB
    if (event.pathParameters === null) {
      throw new ErrorMessage(400, 'Path parameters are null');
    }

    if (event.body == null) {
      throw new ErrorMessage(400, 'Update data is required');
    }

    const id = event.pathParameters['id'];
    console.log('event.pathParameters', event.pathParameters);
    if (!id) {
      throw new ErrorMessage(400, 'Patient Id is not provided');
    }

    session.startTransaction();

    const body = JSON.parse(event.body);

    console.log('body', body);

    const patientId = id; // Use the id from URL path parameter
    const updateData = body.values || body; // Handle both { values: {...} } and {...} structures

    console.log({
      patientId,
      updateData,
    });

    if (updateData?.image && updateData?.image.length > 0) {
      const s3UrlParts = parseS3Url(updateData?.image);
      if (s3UrlParts) {
        await S3KeepPermanently(s3UrlParts.bucketName, s3UrlParts.key);
      } else {
        throw new ErrorMessage(400, 'Invalid image URL');
      }
    }

    if (
      updateData?.identifications &&
      Array.isArray(updateData.identifications) &&
      updateData.identifications.length > 0
    ) {
      await keepUrlsPermanently(updateData.identifications);
    }

    const updatedPatient = await Patients.findOneAndUpdate(
      { patientId: patientId },
      { $set: updateData },
      { new: true, session, runValidators: true }, // Return the updated document and run schema validators
    ).lean();

    if (!updatedPatient) {
      throw new ErrorMessage(404, 'Patient not found');
    }

    // Commit the transaction
    await session.commitTransaction();

    // Return success response with updated patient data
    console.log(
      '🎉 Edit Patient SUCCESS - MongoDB Connection & Frontend Parameter Fix Applied',
    );
    return successResponse('Patient updated successfully', {
      ...updatedPatient,
      _debug: {
        mongoConnectionFixed: true,
        frontendParameterFixed: true,
        deployTime: new Date().toISOString(),
      },
    });
  } catch (error) {
    // Rollback the transaction
    await session.abortTransaction();
    return errorResponse(error);
  } finally {
    // End the session
    session.endSession();
  }
};
