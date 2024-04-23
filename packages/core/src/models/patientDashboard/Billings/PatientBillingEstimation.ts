import mongoose, { Document, PaginateModel, Schema } from "mongoose";
import { EPatientBillingServiceType } from "./PatientBilling";
import paginate from "mongoose-paginate-v2";

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
  estimatedTax: number;
  taxRate: number;
  cost: number;
  estimatedPrice: number;
  estimatedTotal: number;
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
    taxRate: { type: Number, required: true, min: 0 },
    cost: { type: Number, required: true, min: 0 },
    estimatedTax: { type: Number, required: true, min: 0 },
    estimatedPrice: { type: Number, required: true, min: 0 },
    estimatedTotal: { type: Number, required: true, min: 0 },
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

patientBillingEstimationSchema.plugin(paginate);

interface PatientBillingEstimationDocument
  extends Document,
    IPatientBillingEstimation {}

export const PatientBillingEstimation = mongoose.model<
  PatientBillingEstimationDocument,
  PaginateModel<PatientBillingEstimationDocument>
>("PatientBillingEstimation", patientBillingEstimationSchema);
