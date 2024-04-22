import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import errorMessage from "@evara-backend/core/lib/utils/errorMessage";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/lib/utils/successResponse";
import {
  EPatientBillingEstimationStatus,
  PatientBillingEstimation,
} from "@evara-backend/core/models/patientDashboard/Billings/PatientBillingEstimation";
import {
  EPatientBillingStatus,
  PatientBilling,
} from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  const conn = await connectMongoDb();
  const session = await conn.startSession();
  session.startTransaction();

  try {
    // Connect to MongoDB

    if (event.body == null) {
      throw new errorMessage(400, "Data is required");
    }

    const { estimations, clinicId, branchId } = JSON.parse(event.body);

    const createdBy = "user 1";

    const items = [];
    let total = 0;
    let discount = 0;
    let tax = 0;
    let grandTotal = 0;
    let patientCode = "";

    for (const estimationId of estimations) {
      const estimation = await PatientBillingEstimation.findById(
        estimationId
      ).lean();

      if (!estimation) {
        throw new errorMessage(404, "Estimation not found");
      }

      // Accumulate totals
      total += estimation.total;
      // tax += (estimation.total * (estimation.taxRate || 0)) / 100; // Assuming taxRate is a percentage of the total

      patientCode = estimation.patientCode;

      items.push({
        estimationId: estimation._id,
        masterServiceId: estimation.masterServiceId,
        doctorId: estimation.doctorId,
        serviceId: estimation.serviceId,
        serviceName: estimation.serviceName,
        serviceType: estimation.serviceType,
        quantity: estimation.quantity,
        price: estimation.estimatedPrice,
        discount: 0,
        tax: 0,
        total: estimation.total,
      });
    }

    grandTotal = total - discount + tax;

    // Create a new billing document
    const newBilling = new PatientBilling({
      clinicId,
      branchId,
      patientCode,
      createdBy,
      items,
      total,
      discount,
      tax,
      grandTotal,
      status: EPatientBillingStatus.Pending,
    });

    await newBilling.save({ session: session });

    await Promise.all(
      estimations.map((estimationId: string) =>
        PatientBillingEstimation.findByIdAndUpdate(
          estimationId,
          {
            status: EPatientBillingEstimationStatus.Inactive,
          },
          {
            session: session,
          }
        )
      )
    );

    await session.commitTransaction();
    return successResponse("Billing generated successfully");
  } catch (error) {
    await session.abortTransaction();
    return errorResponse(error);
  } finally {
    session.endSession();
  }
};
