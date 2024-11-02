import { APIGatewayProxyHandler } from 'aws-lambda';

import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import Donor from '@evara-backend/core/models/mastersDashboard/local/Donor';
import Case from '@evara-backend/core/models/Cases';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { S3KeepPermanently, parseS3Url } from 'src/files/_KeepPermanently';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const auth = extractAuthorizerDetails(event);

  try {
    const mongoose = await connectMongoDb();
    // Connect to MongoDB

    if (event.body == null) {
      throw new ErrorMessage(400, "Patient's data is required");
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    // TODO: Remove clinicId and branchId after adding authentication
    data.clinicId = auth?.clinicId;
    data.branchId = auth?.branchId;

    // TODO: Upload profile image to S3 and get the URL

    // Create a new patient document
    const newPatient = new Donor(data);

    // Save the patient to the database
    const patient = await newPatient.save();

    if (data.image && data.image.length > 0) {
      const s3UrlParts = parseS3Url(data.image);
      if (s3UrlParts) {
        await S3KeepPermanently(s3UrlParts.bucketName, s3UrlParts.key);
      } else {
        throw new ErrorMessage(400, 'Invalid image URL');
      }
    }

    // Commit the transaction

    // Return success response
    return successResponse('Donor added successfully');
  } catch (error) {
    // Rollback the transaction
    return errorResponse(error);
  } finally {
    // End the session
  }
};
