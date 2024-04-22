import mongoose, { Document, Schema } from "mongoose";
import { EPatientBillingServiceType } from "./PatientBilling"; // Ensure this path is correct

interface IPatientBillingEstimation extends Document {
  clinicId: string;
  branchId: string;
  patientID: mongoose.Types.ObjectId;
  patientCode: string;
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
    clinicId: { type: String, required: true },
    branchId: { type: String, required: true },
    patientID: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: "Patient",
    },
    patientCode: { type: String, required: true, index: true, unique: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    serviceName: { type: String, required: true },
    serviceType: {
      type: String,
      enum: Object.values(EPatientBillingServiceType),
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
    },
    estimatedPrice: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: { type: String, required: true, default: "Active" },
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
