import mongoose, { Document, PaginateModel, Schema } from 'mongoose';
import { autoIncrementId } from '../Counters';
import paginate from 'mongoose-paginate-v2';
import { PoNumberCounter } from './PONumberCounter';

export enum EPurchaseOrderStatus {
  Draft = 'Draft',
  Approved = 'Approved',
  Rejected = 'Rejected',
  Ordered = 'Ordered',
  PartiallyProcessed = 'PartiallyProcessed',
  Processed = 'Processed',
  WaitingForApproval = 'WaitingForApproval',
  PartialPOWaitingForApproval = 'PartialPOWaitingForApproval',
  RejectedByAdmin = 'RejectedByAdmin',
  PartialPORejectedByAdmin = 'PartialPORejectedByAdmin',
}

export enum EItemStatus {
  Processed = 'Processed',
  PartiallyProcessed = 'PartiallyProcessed',
  Pending = 'Pending',
  NewlyProcessed = 'NewlyProcessed',
  ProcessedWithoutUpdating = 'ProcessedWithoutUpdating',
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
    discount: number; // Discount per item
  }[];
  netAmount: number;
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
    discount: number; // Discount per item
  }[];
  netAmount: number;
  otherCharges: number;
  subTotal: number;
  tax: number;
  invoice: string[];
  invoiceNumber: string; // New field for invoice number
  status: string; // New field for status
  report?: {
    reportName: string;
    bucket: string;
    key: string;
  };
}

export interface IPurchaseOrder extends Document {
  branchId: string;
  clinicId: string;
  poNumber: string;
  date: Date;
  vendor: Schema.Types.ObjectId;
  request: IPurchaseOrderRequest;
  responses: IPurchaseOrderResponse[];
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
  report?: {
    reportName: string;
    bucket: string;
    key: string;
  }; // Field for storing PDF report information
  reportProcessed?: {
    reportName: string;
    bucket: string;
    key: string;
  };
}

const itemSchema = new Schema({
  item: { type: Schema.Types.ObjectId, ref: 'DrugItem', required: true },
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
  discount: { type: Number, required: false, min: 0 }, // Discount at the item level

  status: { type: String, enum: Object.values(EItemStatus), required: false },
});

const responseSchema = new Schema({
  items: [itemSchema],
  netAmount: { type: Number, required: false, min: 0 },
  otherCharges: { type: Number, required: false, min: 0 },
  subTotal: { type: Number, required: false, min: 0 },
  tax: { type: Number, required: false, min: 0 },
  invoice: [{ type: String }],
  invoiceNumber: { type: String, required: false },
  status: { type: String, enum: Object.values(EItemStatus), required: true }, // Status for the response
  report: {
    reportName: { type: String, required: false },
    bucket: { type: String, required: false },
    key: { type: String, required: false },
  },
});

const purchaseOrderSchema = new Schema(
  {
    clinicId: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    poNumber: { type: String, unique: true, index: true },
    date: { type: Date, required: true },
    vendor: { type: Schema.Types.ObjectId, ref: 'DrugVendor', required: true },
    request: {
      items: [itemSchema],
      netAmount: { type: Number, required: true, min: 0 },
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
      ref: 'ClinicBranches',
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
    report: {
      reportName: { type: String, required: false },
      bucket: { type: String, required: false },
      key: { type: String, required: false },
    }, // Add the report field for storing the PDF report details
    reportProcessed: {
      reportName: { type: String, required: false },
      bucket: { type: String, required: false },
      key: { type: String, required: false },
    },
    payloadForApproval: {
      type: Object, // Flexible field to store the payload
      required: false,
    },
  },
  { timestamps: true },
);

purchaseOrderSchema.index({ vendor: 1, date: -1 });
purchaseOrderSchema.index({ status: 1 });
purchaseOrderSchema.index({ createdBy: 1, authorizedBy: 1 });
purchaseOrderSchema.index({ branchId: 1, date: -1 });

purchaseOrderSchema.pre('validate', function (next) {
  if (this.status === EPurchaseOrderStatus.Approved && !this.authorizedBy) {
    this.invalidate(
      'authorizedBy',
      'authorizedBy is required when the status is Approved',
    );
  } else if (
    this.status === EPurchaseOrderStatus.Rejected &&
    !this.authorizedBy
  ) {
    this.invalidate(
      'authorizedBy',
      'authorizedBy is required when the status is Rejected',
    );
  }
  next();
});

// purchaseOrderSchema.pre("save", autoIncrementId("purchaseOrder", "poNumber", "PO-"));

purchaseOrderSchema.pre('save', async function (next) {
  const purchaseOrder = this as IPurchaseOrderDocument;

  // Only generate the PO number if the document is new
  if (purchaseOrder.isNew) {
    const currentDate = new Date();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0'); // Get current month
    const year = currentDate.getFullYear(); // Get current year
    const monthYear = `${month}-${year}`; // Format: "09-2024"

    const branchId = purchaseOrder.branchId; // Assuming branchId is available in the document

    // Find or create a counter for the current branch and month-year
    const counter = await PoNumberCounter.findOneAndUpdate(
      { branchId, monthYear },
      { $inc: { sequence: 1 } }, // Increment the sequence
      { new: true, upsert: true }, // Create if doesn't exist
    );

    // Generate the PO number in the format: KL/09-2024/001
    const sequence = String(counter.sequence).padStart(3, '0'); // Zero-pad the sequence
    purchaseOrder.poNumber = `${branchId}/${monthYear}/${sequence}`;
  }

  next();
});

purchaseOrderSchema.plugin(paginate);

export interface IPurchaseOrderDocument extends Document, IPurchaseOrder {}

export const PurchaseOrder = mongoose.model<
  IPurchaseOrderDocument,
  PaginateModel<IPurchaseOrderDocument>
>('PurchaseOrder', purchaseOrderSchema);
