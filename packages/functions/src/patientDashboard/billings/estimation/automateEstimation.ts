import { SQSEvent, SQSHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import errorMessage from "@evara-backend/core/lib/utils/errorMessage";
import { PatientBillingEstimation } from "@evara-backend/core/models/patientDashboard/Billings/PatientBillingEstimation";
import { findServiceByIdAndType } from "./addEstimation";

// Handler function for SQS
export const main: SQSHandler = async (event: SQSEvent) => {
  await connectMongoDb(); // Ensure MongoDB is connected

  try {
    // Iterate over each SQS message
    for (const message of event.Records) {
      const data = JSON.parse(message.body);

      console.log("Processing message", data.Message);

      // Add clinic and branch IDs (these should ideally come from the message or an authenticated context)
      data.clinicId = "EV";
      data.branchId = "KL";

      // const service = await findServiceByIdAndType(
      //   data.serviceId,
      //   data.serviceType
      // );
      // if (!service) {
      //   throw new errorMessage(404, "Service not found");
      // }

      // const total = data.quantity * service.cost;

      // const newEstimation = new PatientBillingEstimation({
      //   ...data,
      //   estimatedPrice: service.cost,
      //   total: total,
      //   status: "Active",
      // });

      // await newEstimation.save();

      // // Normally, you'd not return HTTP responses here; instead, log success or handle internally
      // console.log("Estimation added successfully", {
      //   estimationId: newEstimation._id,
      // });
      console.log("Estimation added successfully");
    }
  } catch (error) {
    console.error("Error processing SQS message", error);
    // Depending on your setup, you might want to throw the error to retry or handle it quietly
    throw error; // Throwing error will cause the message to be re-queued and retried
  }
};
