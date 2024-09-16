import mongoose, { Document, PaginateModel, Schema } from "mongoose";
import paginate from "mongoose-paginate-v2";
import { autoIncrementId } from "../../Counters";
import { EServiceTypes } from "../services/DefaultService";

export enum EPaitentBillingPaymentType {
  Payment = "Payment",
  Refund = "Refund",
  Advance = "Advance",
}

export enum EPatientBillingStatus {
  Pending = "Pending",
  Advance = "Advance",
  Refunded = "Refunded",
  Paid = "Paid",
  Archived = "Archived",
}

export enum EPatientBillingServiceType {
  Investigation = "Investigation",
  Procedure = "Procedure",
  Pharmacy = "Pharmacy",
  Service = "Service",
  CryoPreservation = "Cryo Preservation",
  TreatmentCycle = "Treatment Cycle",
  Package = "Package",
}

export enum EPaymentMethod {
  Cash = "Cash",
  CreditCard = "CreditCard",
  BankTransfer = "BankTransfer",
  Online = "Online",
  UPI = "UPI",
}

interface PaymentDetail {
  amount: number;
  method: EPaymentMethod;
  paymentDate?: Date;
  details?: string;
  type: EPaitentBillingPaymentType;
}

interface PharmacyDetails {
  stock: mongoose.Types.ObjectId;
  batchNo: string;
  location: mongoose.Types.ObjectId;
}

interface RefundDetail {
  refundAmount: number;
  method: EPaymentMethod;
  reason: string;
  refundDate?: Date;
}

interface Item {
  estimationId: mongoose.Types.ObjectId;
  masterServiceId: mongoose.Types.ObjectId;
  serviceId?: mongoose.Types.ObjectId;
  serviceName: string;
  serviceType: EPatientBillingServiceType;
  doctorId: mongoose.Types.ObjectId;
  batchNo?: string;
  expiryDate?: Date;
  quantity: number;
  mrpPerUnit?: number;
  price: number;
  discount: number;
  tax: number;
  taxRate?: number;
  total: number;
  pharmacyDetails?: PharmacyDetails;
}

export interface IPatientBilling extends Document {
  billingId: string;
  clinicId: string;
  branchId?: string;
  patientCode: string;
  items: Item[];
  amount: number;
  discount: number;
  discountInPercentage: number;
  discountReason: string;
  discountFile: string;
  tax: number;
  billType: EPatientBillingServiceType;
  payments: PaymentDetail[];
  refundDetails?: RefundDetail[]; // field for refund details
  status: EPatientBillingStatus;
  createdBy: string;
  modifiedBy?: string;
  subTotal: number;
  grandTotal: number;
  totalPaid: number;
  totalPaymentAttempt: number;
  totalDues: number;
  totalRefunded: number;
  totalAdvance: number;
}

const paymentDetailSchema = new Schema<PaymentDetail>({
  amount: { type: Number, required: true, min: 0 },
  method: {
    type: String,
    enum: Object.values(EPaymentMethod),
    required: true,
  },
  paymentDate: { type: Date },
  details: { type: String },
  type: {
    type: String,
    enum: Object.values(EPaitentBillingPaymentType),
    required: true,
  },
});

const pharmacyDetailsSchema = new Schema<PharmacyDetails>({
  stock: { type: mongoose.Schema.Types.ObjectId, ref: "PharmacyStock" },
  batchNo: { type: String },
  location: { type: mongoose.Schema.Types.ObjectId, ref: "DrugLocation" },
});

const refundDetailSchema = new Schema<RefundDetail>({
  refundAmount: { type: Number, required: true },
  method: {
    type: String,
    enum: Object.values(EPaymentMethod),
    required: true,
  },
  reason: { type: String, required: true },
  refundDate: { type: Date, default: Date.now },
});

const itemSchema = new Schema<Item>({
  estimationId: { type: mongoose.Schema.Types.ObjectId, required: true },
  masterServiceId: { type: mongoose.Schema.Types.ObjectId, required: true },
  serviceId: { type: mongoose.Schema.Types.ObjectId },
  serviceName: { type: String, required: true },
  serviceType: {
    type: String,
    enum: Object.values(EPatientBillingServiceType),
    required: true,
  },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctors" },
  quantity: { type: Number, required: true, min: 0 },
  mrpPerUnit: { type: Number, required: false, min: 0 },
  batchNo: { type: String, required: false },
  expiryDate: { type: Date, required: false },
  price: { type: Number, required: true, min: 0 },
  discount: { type: Number, required: true, min: 0 },
  tax: { type: Number },
  taxRate: { type: Number },
  total: { type: Number, required: true, min: 0 },
  pharmacyDetails: { type: pharmacyDetailsSchema },
});

const patientBillingSchema = new Schema<IPatientBilling>(
  {
    billingId: { type: String, unique: true, index: true },
    clinicId: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
    patientCode: { type: String, required: true },
    billType: {
      type: String,
      enum: Object.values(EPatientBillingServiceType),
      required: false,
    },
    items: [itemSchema],
    amount: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    discountInPercentage: { type: Number, default: 0 },
    discountReason: { type: String },
    discountFile: { type: String },
    tax: { type: Number, default: 0 },
    payments: [paymentDetailSchema],
    refundDetails: { type: [refundDetailSchema], required: false },
    status: {
      type: String,
      enum: Object.values(EPatientBillingStatus),
      default: EPatientBillingStatus.Pending,
      required: true,
    },
    createdBy: { type: String, required: true },
    modifiedBy: { type: String },
    totalAdvance: { type: Number, default: 0 },
    totalRefunded: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

patientBillingSchema.virtual("subTotal").get(function (this: IPatientBilling) {
  return this.amount + this.tax;
});

patientBillingSchema
  .virtual("grandTotal")
  .get(function (this: IPatientBilling) {
    return this.subTotal - this.discount;
  });

patientBillingSchema.virtual("totalPaid").get(function (this: IPatientBilling) {
  return this.payments
    .filter((payment) => payment.type === EPaitentBillingPaymentType.Payment)
    .reduce((acc, payment) => acc + payment.amount, 0);
});

patientBillingSchema
  .virtual("totalPaymentAttempts")
  .get(function (this: IPatientBilling) {
    return this.payments.filter(
      (payment) => payment.type === EPaitentBillingPaymentType.Payment
    ).length;
  });

patientBillingSchema.virtual("totalDues").get(function (this: IPatientBilling) {
  return this.grandTotal - this.totalPaid;
});

patientBillingSchema.pre(
  "save",
  autoIncrementId("PatientBilling", "billingId", "BL-")
);

patientBillingSchema.plugin(paginate);

interface PatientBillingDocument extends Document, IPatientBilling {}

export const PatientBilling = mongoose.model<
  PatientBillingDocument,
  PaginateModel<PatientBillingDocument>
>("PatientBilling", patientBillingSchema);
