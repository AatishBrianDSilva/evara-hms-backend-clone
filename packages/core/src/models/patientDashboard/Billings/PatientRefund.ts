import mongoose, { Document, Schema } from "mongoose";

// Define the interface for PatientRefund document
interface IPatientRefund extends Document {
  billingId: Schema.Types.ObjectId;
  patientCode: string;
  refundDetails: {
    refundAmount: number;
    method: string;
    reason: string;
    refundDate: Date;
    charges: number;
    items: {
      serviceName: string;
      itemName: string;
      batchNo: string;
      qtyToRefund: number;
      amountToRefund: number;
    }[];
  };
  createdBy: string;
  branchId: string;
  clinicId: string;
  createdAt: Date;
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
      refundDate: { type: Date, required: true, default: Date.now },
      charges: { type: Number, required: true },
      items: [
        {
          serviceName: { type: String, required: true },
          itemName: { type: String, required: true },
          batchNo: { type: String, required: true },
          qtyToRefund: { type: Number, required: true },
          amountToRefund: { type: Number, required: true },
        },
      ],
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
