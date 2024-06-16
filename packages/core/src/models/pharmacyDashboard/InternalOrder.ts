import mongoose, { Document, PaginateModel, Schema } from "mongoose";
import { autoIncrementId } from "../Counters";
import paginate from "mongoose-paginate-v2";

export enum EInternalOrderStatus {
  Draft = "Draft",
  Approved = "Approved",
  Rejected = "Rejected",
  Processed = "Processed",
}

export interface IInternalOrderBatchDetail extends Document {
  batchId: string;
  deductedQuantity: number;
}

const internalOrderBatchDetailSchema = new mongoose.Schema({
  batchId: { type: String, required: true }, // Batch ID as a string, could be derived from batchNo or a specific identifier
  deductedQuantity: { type: Number, required: true }, // Quantity deducted from this batch
});

export interface IInternalOrder extends Document {
  branchId: string;
  clinicId: string;
  ioNumber: string;
  date: Date;
  items: {
    item: Schema.Types.ObjectId;
    transferFrom: {
      location: Schema.Types.ObjectId;
      quantity: number;
    };
    transferTo: Schema.Types.ObjectId;
    batches: [IInternalOrderBatchDetail]; // Details about which batches quantities were deducted from
    quantity: number;
    notes: string;
  }[];
  createdBy: string;
  authorizedBy: string;
  status: EInternalOrderStatus;
}

const itemSchema = new Schema({
  item: { type: Schema.Types.ObjectId, ref: "PharmacyStock", required: true },
  quantity: { type: Number, required: true, min: 1 },
  batches: [internalOrderBatchDetailSchema],
  transferFrom: {
    location: {
      type: Schema.Types.ObjectId,
      ref: "DrugLocation",
      required: true,
    },
    quantity: { type: Number, required: true },
  },
  transferTo: {
    type: Schema.Types.ObjectId,
    ref: "DrugLocation",
    required: true,
  },
  notes: { type: String, required: false },
});

const internalOrderSchema = new Schema(
  {
    clinicId: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    ioNumber: { type: String, unique: true, index: true },
    date: { type: Date, required: true },
    items: [itemSchema],
    createdBy: { type: String, required: true },
    authorizedBy: { type: String, required: false },
    status: {
      type: String,
      enum: Object.values(EInternalOrderStatus),
      required: true,
      default: EInternalOrderStatus.Draft,
    },
  },
  { timestamps: true }
);

internalOrderSchema.index({ status: 1 });
internalOrderSchema.index({ createdBy: 1, approvedBy: 1 });

internalOrderSchema.pre("validate", function (next) {
  if (this.status === EInternalOrderStatus.Approved && !this.authorizedBy) {
    this.invalidate(
      "authorizedBy",
      "authorizedBy is required when the status is Approved"
    );
  } else if (
    this.status === EInternalOrderStatus.Rejected &&
    !this.authorizedBy
  ) {
    this.invalidate(
      "authorizedBy",
      "rejectedBy is required when the status is Rejected"
    );
  }
  next();
});

internalOrderSchema.pre(
  "save",
  autoIncrementId("internalOrder", "ioNumber", "IO-")
);

internalOrderSchema.plugin(paginate);

export interface IInternalOrderDocument extends Document, IInternalOrder {}

export const InternalOrder = mongoose.model<
  IInternalOrderDocument,
  PaginateModel<IInternalOrderDocument>
>("InternalOrder", internalOrderSchema);
