import { Schema } from "mongoose";
import { EPatientBillingServiceType } from "../../models/patientDashboard/Billings/PatientBilling";
import SNSService from "../aws/sns";

export const publishBillingServiceToSNS = async (
  patientCode: string,
  doctorId: Schema.Types.ObjectId | undefined,
  masterServiceId: Schema.Types.ObjectId,
  serviceId: Schema.Types.ObjectId,
  serviceType: EPatientBillingServiceType,
  serviceName: string,
  serviceCost: number,
  quantity: number,
  clinicId: string,
  branchId: string,
  itemId: Schema.Types.ObjectId, // New field for item ID
  mrp?: number, // Optional MRP
  expiryDate?: Date, // Optional Expiry Date
  vendor?: Schema.Types.ObjectId, // Optional Vendor ID
  packSize?: number // Optional Pack Size
) => {
  const messagePayload = {
    action: "Add",
    data: {
      doctorId: doctorId,
      masterServiceId: masterServiceId,
      serviceId: serviceId,
      serviceType: serviceType,
      serviceName: serviceName,
      serviceCost: serviceCost,
      patientCode: patientCode,
      quantity: quantity,
      clinicId: clinicId,
      branchId: branchId,
      itemId: itemId, // Include item ID
      mrp: mrp, // Include MRP if available
      expiryDate: expiryDate, // Include Expiry Date if available
      vendor: vendor, // Include Vendor ID if available
      packSize: packSize, // Include Pack Size if available
    },
  };

  await SNSService.publishMessage({
    Message: JSON.stringify(messagePayload),
    TopicArn: process.env.BILLING_ESTIMATION_TOPIC_ARN,
  });
};
