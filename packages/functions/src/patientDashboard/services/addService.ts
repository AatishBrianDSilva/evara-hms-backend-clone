import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import PatientService from "@evara-backend/core/src/models/patientDashboard/services/PatientService";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import MasterService from "@evara-backend/core/src/models/patientDashboard/services/MasterService";
import { EPatientBillingServiceType } from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling";
import { publishServiceToSNS } from "@evara-backend/core/src/lib/utils/publishServiceToSNS";
import { S3KeepPermanently, parseS3Url } from "src/files/_KeepPermanently";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    // Connect to MongoDB
    await connectMongoDb();

    if (event.body == null) {
      throw new ErrorMessage(400, "Data is required");
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    // TODO: Remove clinicId and branchId after adding authentication
    data.clinicId = "EV";
    // data.branchId = "KL";

    console.log("Data: ", data);

    if (data.files && Array.isArray(data.files)) {
      for (const fileUrl of data.files) {
        const s3UrlParts = parseS3Url(fileUrl);
        if (s3UrlParts) {
          await S3KeepPermanently(s3UrlParts.bucketName, s3UrlParts.key);
        } else {
          throw new ErrorMessage(400, "Invalid image URL");
        }
      }
    } else {
      throw new ErrorMessage(400, "Invalid files array");
    }

    for (let i = 0; i < data.length; i++) {
      data[i].clinicId = "EV";
      const service = new PatientService(data[i]);
      const newService = await service.save();

      const masterService = await MasterService.findById(newService.service).lean();

      if (masterService) {
        const serviceName = masterService.name;

        // Publish to SNS
        await publishServiceToSNS(
          newService.patientCode,
          newService.doctor,
          newService.service,
          newService._id,
          EPatientBillingServiceType.Service,
          serviceName,
          masterService.cost,
          1
        );
      } else {
        console.error("Master Service not found");
      }
    }

    // Return success response
    return successResponse("service(s) created successfully");
  } catch (error) {
    return errorResponse(error);
  }
};
