import { Schema } from "mongoose";
import { EPatientBillingServiceType } from "../../models/patientDashboard/Billings/PatientBilling";
import SNSService from "../aws/sns";

export const publishServiceToSNS = async (
  patientCode: string,
  doctorId: Schema.Types.ObjectId | undefined,
  masterInvestigationId: Schema.Types.ObjectId,
  serviceId: Schema.Types.ObjectId,
  serviceType: EPatientBillingServiceType,
  serviceName: string,
  serviceCost: number,
  quantity: number
) => {
  const messagePayload = {
    action: "Add",
    data: {
      doctorId: doctorId,
      masterServiceId: masterInvestigationId,
      serviceId: serviceId,
      serviceType: serviceType,
      serviceName: serviceName,
      serviceCost: serviceCost,
      patientCode: patientCode,
      quantity: quantity,
    },
  };

  await SNSService.publishMessage({
    Message: JSON.stringify(messagePayload),
    TopicArn: process.env.BILLING_ESTIMATION_TOPIC_ARN,
  });
};
