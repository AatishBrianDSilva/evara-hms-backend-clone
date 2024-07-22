import mongoose, { Document, PaginateModel, Schema } from "mongoose";
import paginate from "mongoose-paginate-v2";

export interface IInternalConsumptionBatchDetail extends Document {
  batchId: string;
  deductedQuantity: number;
}

const internalConsumptionBatchDetailSchema = new mongoose.Schema({
  batchId: { type: String, required: true }, // Batch ID as a string, could be derived from batchNo or a specific identifier
  deductedQuantity: { type: Number, required: true }, // Quantity deducted from this batch
});

export interface IInternalConsumption extends Document {
  branchId: string;
  clinicId: string;
  icNumber: string;
  date: Date;
  items: {
    item: Schema.Types.ObjectId;
    transferFrom: {
      location: Schema.Types.ObjectId;
      quantity: number;
    };
    batches: [IInternalConsumptionBatchDetail]; // Details about which batches quantities were deducted from
    quantity: number;
    notes: string;
  }[];
  createdBy: string;
}

const itemSchema = new Schema({
  item: { type: Schema.Types.ObjectId, ref: "PharmacyStock", required: true },
  quantity: { type: Number, required: true, min: 1 },
  batches: [internalConsumptionBatchDetailSchema],
  transferFrom: {
    location: {
      type: Schema.Types.ObjectId,
      ref: "DrugLocation",
      required: true,
    },
    quantity: { type: Number, required: true },
  },
  notes: { type: String, required: false },
});

const internalConsumptionSchema = new Schema(
  {
    clinicId: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    icNumber: { type: String, unique: true, index: true },
    date: { type: Date, required: true },
    items: [itemSchema],
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

internalConsumptionSchema.index({ createdBy: 1 });

internalConsumptionSchema.plugin(paginate);

export interface IInternalConsumptionDocument extends Document, IInternalConsumption {}

export const InternalConsumption = mongoose.model<
  IInternalConsumptionDocument,
  PaginateModel<IInternalConsumptionDocument>
>("InternalConsumption", internalConsumptionSchema);
