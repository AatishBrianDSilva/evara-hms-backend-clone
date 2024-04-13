import mongoose, { Document, PaginateModel, Schema } from "mongoose";
import { autoIncrementId } from "../Counters";
import paginate from "mongoose-paginate-v2";

export enum EInternalOrderStatus {
  Pending = "Pending",
  Approved = "Approved",
  Rejected = "Rejected",
  Processed = "Processed",
}

export interface IInternalOrderRequest {
  items: {
    item: Schema.Types.ObjectId;
    quantity: number;
    notes: string;
  }[];
}

export interface IInternalOrderResponse {
  items: {
    item: Schema.Types.ObjectId;
    quantity: number;
    notes: string;
  }[];
}

export interface IInternalOrder extends Document {
  branchId: string;
  ioNumber: string;
  date: Date;
  transferFrom: Schema.Types.ObjectId;
  transferTo: Schema.Types.ObjectId;
  request: IInternalOrderRequest;
  response: IInternalOrderResponse;
  createdBy: string;
  authorizedBy: string;
  status: EInternalOrderStatus;
}

const itemSchema = new Schema({
  item: { type: Schema.Types.ObjectId, ref: "PharmacyStock", required: true },
  quantity: { type: Number, required: true, min: 0 },
  notes: { type: String, required: false },
});

const responseSchema = new Schema({
  items: [itemSchema],
});

const internalOrderSchema = new Schema(
  {
    branchId: { type: String, required: true, index: true },
    ioNumber: { type: String, unique: true, index: true },
    date: { type: Date, required: true },
    transferFrom: {
      type: Schema.Types.ObjectId,
      ref: "DrugLocation",
      required: true,
    },
    transferTo: {
      type: Schema.Types.ObjectId,
      ref: "DrugLocation",
      required: true,
    },
    request: {
      items: [itemSchema],
    },
    response: {
      type: responseSchema,
      default: null,
    },
    createdBy: { type: String, required: true },
    authorizedBy: { type: String, required: false },
    status: {
      type: String,
      enum: Object.values(EInternalOrderStatus),
      required: true,
      default: EInternalOrderStatus.Pending,
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
      "approvedBy is required when the status is Approved"
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
