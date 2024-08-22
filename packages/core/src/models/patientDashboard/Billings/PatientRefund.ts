import mongoose, { Document, Schema } from "mongoose";

// Define the interface for PatientRefund document
interface IPatientRefund extends Document {
  billingId: Schema.Types.ObjectId;
  patientCode: string;
  refundDetails: {
    refundAmount: number;
    method: string;
    reason: string;
    refundDate?: Date;
    charges?: number;
    refundNumber?: string;
    items?: {
      serviceName?: string;
      itemName?: string;
      batchNo?: string;
      qtyToRefund?: number;
      amountToRefund?: number;
    }[];
    files?: string[];
  };
  createdBy: string;
  branchId: string;
  clinicId: string;
  createdAt?: Date;
}

// Define the schema for PatientRefund
const patientRefundSchema = new Schema<IPatientRefund>(
  {
    billingId: { type: Schema.Types.ObjectId, ref: "PatientBilling", required: true },
    patientCode: { type: String, required: true },
    refundDetails: {
      refundAmount: { type: Number, required: true },
      method: { type: String, required: true },
      reason: { type: String, required: true },
      refundDate: { type: Date, default: Date.now },
      charges: { type: Number },
      refundNumber: { type: String },
      items: [
        {
          serviceName: { type: String },
          itemName: { type: String },
          batchNo: { type: String },
          qtyToRefund: { type: Number },
          amountToRefund: { type: Number },
        },
      ],
      files: [{ type: String }],
    },
    createdBy: { type: String, required: true },
    branchId: { type: String, required: true },
    clinicId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Create the PatientRefund model
export const PatientRefund = mongoose.model<IPatientRefund>("PatientRefund", patientRefundSchema);
