import mongoose, { Document, Mixed, Schema } from "mongoose";
import { autoIncrementId } from "../../Counters";
import { EGender } from "../investigation/MedicalTests";

export enum EServiceTypes {
  Appointment = "Appointment",
  FirstConsultation = "First Consultation",
  FollowUp = "Follow Up",
  DoctorsReview = "Doctor's Review",
}

interface IDefaultService extends Document {
  serviceId: string;
  name: string;
  serviceType: EServiceTypes;
  description: string;
  gender: EGender;
}

const DefaultServiceSchema: Schema = new Schema(
  {
    serviceId: {
      type: String,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    serviceType: {
      type: String,
      required: true,
      enum: Object.values(EServiceTypes),
    },
    gender: { type: String, required: true, enum: Object.values(EGender) },
    description: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Assume autoIncrementId is a function/middleware you've defined to auto-increment the testId
DefaultServiceSchema.pre(
  "save",
  autoIncrementId("DefaultService", "serviceId", "S-")
);

const DefaultService = mongoose.model<IDefaultService>(
  "DefaultService",
  DefaultServiceSchema
);

export default DefaultService;
