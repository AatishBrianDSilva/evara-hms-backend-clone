import { SQSEvent, SQSHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import errorMessage from "@evara-backend/core/src/lib/utils/errorMessage";
import {
  EPatientBillingEstimationStatus,
  PatientBillingEstimation,
} from "@evara-backend/core/models/patientDashboard/Billings/PatientBillingEstimation";
import { findServiceByIdAndType } from "./addEstimation";

// Handler function for SQS
export const main: SQSHandler = async (event: SQSEvent) => {
  await connectMongoDb(); // Ensure MongoDB is connected

  try {
    // Iterate over each SQS message
    for (const message of event.Records) {
      const payload = JSON.parse(message.body);

      console.log("Processing message", payload.Message);

      const { action, data } = JSON.parse(payload.Message);

      switch (action) {
        case "Add":
          await addEstimation(data);
          break;
        case "Delete":
          await deleteEstimation(data.serviceId);
          break;
        default:
          break;
      }

      // Success processing message
      console.log("Message processed successfully");
    }
  } catch (error) {
    console.error("Error processing SQS message", error);
    throw error; // Throwing error will cause the message to be re-queued and retried
  }
};

// Add estimation function
const addEstimation = async (data: any) => {
  // Add clinic and branch IDs (these should ideally come from the message or an authenticated context)
  data.clinicId = "EV";
  data.branchId = "KL";

  const service = await findServiceByIdAndType(
    data.masterServiceId,
    data.serviceType
  );

  if (!service) {
    throw new errorMessage(404, "Service not found");
  }

  const estimatedPrice = service.cost * data.quantity;
  const estimatedTax = (service.tax * estimatedPrice) / 100;

  const total = estimatedPrice + estimatedTax;

  const newEstimation = new PatientBillingEstimation({
    ...data,
    estimatedTax: estimatedTax,
    taxRate: service.tax,
    cost: service.cost,
    estimatedPrice: estimatedPrice,
    estimatedTotal: total,
    status: "Active",
  });

  await newEstimation.save();

  // Success processing message
  console.log("Estimation added successfully", {
    estimationId: newEstimation._id,
  });
};

// Delete estimation function
const deleteEstimation = async (serviceId: string) => {
  // Add clinic and branch IDs (these should ideally come from the message or an authenticated context)

  // Find and delete the estimation
  const estimation = await PatientBillingEstimation.findOneAndDelete({
    serviceId: serviceId,
  });

  if (!estimation) {
    throw new errorMessage(404, "Estimation not found");
  }

  // Success processing message
  console.log("Estimation deleted successfully", {
    estimationId: estimation._id,
  });
};
