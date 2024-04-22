import mongoose, { Document, Schema } from "mongoose";
import { autoIncrementId } from "../../Counters";

export enum EPatientBillingStatus {
  Pending = "Pending",
  Advance = "Advance",
  Refund = "Refund",
  Paid = "Paid",
  Archived = "Archived",
}

export enum EPatientBillingServiceType {
  Investigation = "Investigation",
  Procedure = "Procedure",
  Medicine = "Medicine",
  Service = "Service",
  CryoPreservation = "CryoPreservation",
  TreatmentCycle = "TreatmentCycle",
}

interface Item {
  serviceId: mongoose.Types.ObjectId;
  serviceName: string;
  serviceCode: string;
  serviceType: EPatientBillingServiceType;
  quantity: number;
  price: number;
  discount: number;
  tax: number;
  total: number;
}

interface IPatientBilling extends Document {
  billingId: string;
  clinicId: string;
  branchId?: string;
  patientCode: string;
  patientID: mongoose.Types.ObjectId;
  items: Item[];
  total: number;
  discount: number;
  tax: number;
  grandTotal: number;
  status: EPatientBillingStatus;
  // createdBy: mongoose.Types.ObjectId;
  // modifiedBy?: mongoose.Types.ObjectId;
  createdBy: string;
  modifiedBy?: string;
  modifiedAt?: Date;
}

const itemSchema = new Schema<Item>({
  serviceId: { type: mongoose.Schema.Types.ObjectId, required: true },
  serviceName: { type: String, required: true },
  serviceCode: { type: String, required: true },
  serviceType: {
    type: String,
    enum: Object.values(EPatientBillingServiceType),
    required: true,
  },
  quantity: { type: Number, required: true, min: 0 },
  price: { type: Number, required: true, min: 0 },
  discount: { type: Number, required: true, min: 0 },
  tax: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
});

const patientBillingSchema = new Schema<IPatientBilling>(
  {
    billingId: { type: String, unique: true },
    clinicId: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
    patientCode: { type: String, required: true },
    patientID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },
    items: [itemSchema],
    total: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    status: {
      type: String,
      enum: Object.values(EPatientBillingStatus),
      default: EPatientBillingStatus.Pending,
      required: true,
    },
    // createdBy: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   required: true,
    //   ref: "User",
    // },
    // modifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: String, required: true },
    modifiedBy: { type: String },
    modifiedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

patientBillingSchema.pre(
  "save",
  autoIncrementId("PatientBilling", "billingId", "B-")
);

export const PatientBilling = mongoose.model<IPatientBilling>(
  "PatientBilling",
  patientBillingSchema
);
