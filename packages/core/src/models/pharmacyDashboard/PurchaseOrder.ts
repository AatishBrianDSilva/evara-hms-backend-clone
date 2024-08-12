import mongoose, { Document, PaginateModel, Schema } from "mongoose";
import { autoIncrementId } from "../Counters";
import paginate from "mongoose-paginate-v2";

export enum EPurchaseOrderStatus {
  Draft = "Draft",
  Approved = "Approved",
  Rejected = "Rejected",
  Ordered = "Ordered",
  PartiallyProcessed = "PartiallyProcessed",
  Processed = "Processed",
}

export enum EItemStatus {
  Processed = "Processed",
  PartiallyProcessed = "PartiallyProcessed",
  Pending = "Pending",
  NewlyProcessed = "NewlyProcessed",
  ProcessedWithoutUpdating = "ProcessedWithoutUpdating",
}

export interface IPurchaseOrderRequest {
  items: {
    item: Schema.Types.ObjectId;
    packSize: number;
    mrp: number;
    mrpPerPack: number;
    buyPrice: number;
    total: number;
    tax: number;
    quantity: number;
    fulfilledQuantity: number; // New field to track the fulfilled quantity
    freeQuantity: number;
    noOfPacks: number;
    packsRequired: number; // Include packsRequired in request
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
    mrpPerPack: number;
    buyPrice: number;
    tax: number;
    quantity: number;
    fulfilledQuantity: number; // New field to track the fulfilled quantity
    freeQuantity: number;
    noOfPacks: number;
    packsRequired: number; // Include packsRequired in response
    status?: EItemStatus; // Optional status field
  }[];
  netAmount: number;
  discount: number;
  otherCharges: number;
  subTotal: number;
  tax: number;
  invoice: string[];
  invoiceNumber: string; // New field for invoice number
  status: string; // New field for status
}

export interface IPurchaseOrder extends Document {
  branchId: string;
  clinicId: string;
  poNumber: string;
  date: Date;
  vendor: Schema.Types.ObjectId;
  request: IPurchaseOrderRequest;
  responses: IPurchaseOrderResponse[]; // Change to an array of responses
  branch: Schema.Types.ObjectId;
  createdBy: string;
  authorizedBy: string;
  status: EPurchaseOrderStatus;
  newAddress?: {
    branchName: string;
    street: string;
    city: string;
    state: string;
    zip: string;
  }; // Optional field for new address
}

const itemSchema = new Schema({
  item: { type: Schema.Types.ObjectId, ref: "DrugItem", required: true },
  packSize: { type: Number, required: true, min: 0 },
  batchNo: { type: String, required: false },
  expiryDate: { type: Date, required: false },
  mrp: { type: Number, required: true, min: 0 },
  mrpPerPack: { type: Number, required: true, min: 0 },
  buyPrice: { type: Number, required: true, min: 0 },
  tax: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 0 },
  freeQuantity: { type: Number, required: false, min: 0 },
  noOfPacks: { type: Number, required: true, min: 0 },
  packsRequired: { type: Number, required: false, min: 0 },
  status: { type: String, enum: Object.values(EItemStatus), required: false },
});

const responseSchema = new Schema({
  items: [itemSchema],
  netAmount: { type: Number, required: false, min: 0 },
  discount: { type: Number, required: false, min: 0 },
  otherCharges: { type: Number, required: false, min: 0 },
  subTotal: { type: Number, required: false, min: 0 },
  tax: { type: Number, required: false, min: 0 },
  invoice: [{ type: String }],
  invoiceNumber: { type: String, required: false },
  status: { type: String, enum: Object.values(EItemStatus), required: true }, // Status for the response
});

const purchaseOrderSchema = new Schema(
  {
    clinicId: { type: String, required: true, index: true },
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
    responses: {
      type: [responseSchema], // Change to an array of responses
      default: [],
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
    invoiceNumber: { type: String, required: false },
    newAddress: {
      branchName: { type: String, required: false },
      street: { type: String, required: false },
      city: { type: String, required: false },
      state: { type: String, required: false },
      zip: { type: String, required: false },
    }, // Optional field for new address
  },
  { timestamps: true }
);

purchaseOrderSchema.index({ vendor: 1, date: -1 });
purchaseOrderSchema.index({ status: 1 });
purchaseOrderSchema.index({ createdBy: 1, authorizedBy: 1 });
purchaseOrderSchema.index({ branchId: 1, date: -1 });

purchaseOrderSchema.pre("validate", function (next) {
  if (this.status === EPurchaseOrderStatus.Approved && !this.authorizedBy) {
    this.invalidate("authorizedBy", "authorizedBy is required when the status is Approved");
  } else if (this.status === EPurchaseOrderStatus.Rejected && !this.authorizedBy) {
    this.invalidate("authorizedBy", "authorizedBy is required when the status is Rejected");
  }
  next();
});

purchaseOrderSchema.pre("save", autoIncrementId("purchaseOrder", "poNumber", "PO-"));

purchaseOrderSchema.plugin(paginate);

export interface IPurchaseOrderDocument extends Document, IPurchaseOrder {}

export const PurchaseOrder = mongoose.model<
  IPurchaseOrderDocument,
  PaginateModel<IPurchaseOrderDocument>
>("PurchaseOrder", purchaseOrderSchema);
