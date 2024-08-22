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
  itemId?: Schema.Types.ObjectId,
  mrp?: number,
  expiryDate?: Date,
  vendor?: Schema.Types.ObjectId,
  packSize?: number
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
      itemId: itemId,
      mrp: mrp,
      expiryDate: expiryDate,
      vendor: vendor,
      packSize: packSize,
    },
  };

  await SNSService.publishMessage({
    Message: JSON.stringify(messagePayload),
    TopicArn: process.env.BILLING_ESTIMATION_TOPIC_ARN,
  });
};
