import mongoose, { Document, Schema } from "mongoose";
import { EPatientBillingServiceType } from "./PatientBilling"; // Ensure this path is correct

export enum EPatientBillingEstimationStatus {
  Active = "Active",
  Inactive = "Inactive",
}

interface IPatientBillingEstimation extends Document {
  clinicId: string;
  branchId: string;
  patientCode: string;
  doctorId: mongoose.Types.ObjectId;
  masterServiceId: mongoose.Types.ObjectId;
  serviceId: mongoose.Types.ObjectId;
  serviceName: string;
  serviceType: EPatientBillingServiceType;
  quantity: number;
  estimatedPrice: number;
  total: number;
  status: "Active" | "Inactive";
}

const patientBillingEstimationSchema = new Schema<IPatientBillingEstimation>(
  {
    clinicId: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    patientCode: { type: String, required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "doctors" },
    masterServiceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
    },
    serviceName: { type: String, required: true, index: true },
    serviceType: {
      type: String,
      enum: Object.values(EPatientBillingServiceType),
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
    },
    estimatedPrice: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: Object.values(EPatientBillingEstimationStatus),
      required: true,
      default: EPatientBillingEstimationStatus.Active,
    },
  },
  {
    timestamps: true,
  }
);

export const PatientBillingEstimation =
  mongoose.model<IPatientBillingEstimation>(
    "PatientBillingEstimation",
    patientBillingEstimationSchema
  );
