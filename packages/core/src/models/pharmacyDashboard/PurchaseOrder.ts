import mongoose, { Document, PaginateModel, Schema } from "mongoose";
import { autoIncrementId } from "../Counters";
import paginate from "mongoose-paginate-v2";
import { log } from "console";

export enum EPurchaseOrderStatus {
  Draft = "Draft",
  Approved = "Approved",
  Rejected = "Rejected",
  Ordered = "Ordered",
  PartiallyProcessed = "PartiallyProcessed",
  Processed = "Processed",
}

export interface IPurchaseOrderRequest {
  items: {
    item: Schema.Types.ObjectId;
    packSize: number;
    mrp: number;
    mrpPerUnit: number;
    buyPrice: number;
    total: number;
    tax: number;
    quantity: number;
  }[];
  netAmount: number;
  discount: number;
  otherCharges: number;
  subTotal: number;
  tax: number;
}

export interface IPurchaseOrderResponse {
  items: {
    item: Schema.Types.ObjectId;
    packSize: number;
    batchNo: string;
    expiryDate: Date;
    mrp: number;
    mrpPerUnit: number;
    buyPrice: number;
    tax: number;
    quantity: number;
  }[];
  netAmount: number;
  discount: number;
  otherCharges: number;
  subTotal: number;
  tax: number;
  invoice: string[];
}

export interface IPurchaseOrder extends Document {
  branchId: string;
  poNumber: string;
  date: Date;
  vendor: Schema.Types.ObjectId;
  request: IPurchaseOrderRequest;
  response: IPurchaseOrderResponse;
  branch: Schema.Types.ObjectId;
  createdBy: string;
  authorizedBy: string;
  status: EPurchaseOrderStatus;
}

const itemSchema = new Schema({
  item: { type: Schema.Types.ObjectId, ref: "DrugItem", required: true },
  packSize: { type: Number, required: true, min: 0 },
  batchNo: { type: String, required: false },
  expiryDate: { type: Date, required: false },
  mrp: { type: Number, required: true, min: 0 },
  mrpPerUnit: { type: Number, required: true, min: 0 },
  buyPrice: { type: Number, required: true, min: 0 },
  tax: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 0 },
});

const responseSchema = new Schema({
  items: [itemSchema],
  packSize: { type: Number, required: true, min: 0 },
  netAmount: { type: Number, required: false, min: 0 },
  discount: { type: Number, required: false, min: 0 },
  otherCharges: { type: Number, required: false, min: 0 },
  subTotal: { type: Number, required: false, min: 0 },
  tax: { type: Number, required: false, min: 0 },
  invoice: [{ type: String }],
});

const purchaseOrderSchema = new Schema(
  {
    branchId: { type: String, required: true, index: true },
    poNumber: { type: String, unique: true, index: true },
    date: { type: Date, required: true },
    vendor: { type: Schema.Types.ObjectId, ref: "DrugVendor", required: true },
    request: {
      items: [itemSchema],
      netAmount: { type: Number, required: true, min: 0 },
      discount: { type: Number, required: true, min: 0 },
      otherCharges: { type: Number, required: true, min: 0 },
      subTotal: { type: Number, required: true, min: 0 },
      tax: { type: Number, required: true, min: 0 },
    },
    response: {
      type: responseSchema,
      default: null,
    },
    createdBy: { type: String, required: true },
    authorizedBy: { type: String, required: false },
    branch: {
      type: Schema.Types.ObjectId,
      ref: "ClinicBranches",
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(EPurchaseOrderStatus),
      required: true,
      default: EPurchaseOrderStatus.Draft,
    },
  },
  { timestamps: true }
);

purchaseOrderSchema.index({ vendor: 1, date: -1 });
purchaseOrderSchema.index({ status: 1 });
purchaseOrderSchema.index({ createdBy: 1, authorizedBy: 1 });
purchaseOrderSchema.index({ branchId: 1, date: -1 });

purchaseOrderSchema.pre("validate", function (next) {
  if (this.status === EPurchaseOrderStatus.Approved && !this.authorizedBy) {
    this.invalidate(
      "authorizedBy",
      "approvedBy is required when the status is Approved"
    );
  } else if (
    this.status === EPurchaseOrderStatus.Rejected &&
    !this.authorizedBy
  ) {
    this.invalidate(
      "authorizedBy",
      "rejectedBy is required when the status is Rejected"
    );
  }
  next();
});

purchaseOrderSchema.pre(
  "save",
  autoIncrementId("purchaseOrder", "poNumber", "PO-")
);

purchaseOrderSchema.plugin(paginate);

export interface IPurchaseOrderDocument extends Document, IPurchaseOrder {}

export const PurchaseOrder = mongoose.model<
  IPurchaseOrderDocument,
  PaginateModel<IPurchaseOrderDocument>
>("PurchaseOrder", purchaseOrderSchema);
