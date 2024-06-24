import mongoose, { Document, PaginateModel, Schema } from "mongoose";
import paginate from "mongoose-paginate-v2";
import { autoIncrementId } from "../../Counters";

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

interface Item {
  estimationId: mongoose.Types.ObjectId;
  masterServiceId: mongoose.Types.ObjectId;
  serviceId?: mongoose.Types.ObjectId;
  serviceName: string;
  serviceType: EPatientBillingServiceType;
  doctorId: mongoose.Types.ObjectId;
  quantity: number;
  price: number;
  discount: number;
  tax: number;
  total: number;
}

export interface IPatientBilling extends Document {
  billingId: string;
  clinicId: string;
  branchId?: string;
  patientCode: string;
  items: Item[];
  amount: number;
  discount: number;
  tax: number;
  payments: PaymentDetail[];
  status: EPatientBillingStatus;
  // createdBy: mongoose.Types.ObjectId;
  // modifiedBy?: mongoose.Types.ObjectId;
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
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "doctors" },
  quantity: { type: Number, required: true, min: 0 },
  price: { type: Number, required: true, min: 0 },
  discount: { type: Number, required: true, min: 0 },
  tax: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
});

const patientBillingSchema = new Schema<IPatientBilling>(
  {
    billingId: { type: String, unique: true, index: true },
    clinicId: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
    patientCode: { type: String, required: true },
    items: [itemSchema],
    amount: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    payments: [paymentDetailSchema],
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

patientBillingSchema.virtual("grandTotal").get(function (this: IPatientBilling) {
  return this.subTotal - this.discount;
});

patientBillingSchema.virtual("totalPaid").get(function (this: IPatientBilling) {
  return this.payments
    .filter((payment) => payment.type === EPaitentBillingPaymentType.Payment)
    .reduce((acc, payment) => acc + payment.amount, 0);
});

patientBillingSchema.virtual("totalPaymentAttempts").get(function (this: IPatientBilling) {
  return this.payments.filter(
    (payment) => payment.type === EPaitentBillingPaymentType.Payment
  ).length;
});

patientBillingSchema.virtual("totalDues").get(function (this: IPatientBilling) {
  return this.grandTotal - this.totalPaid;
});

patientBillingSchema.pre("save", autoIncrementId("PatientBilling", "billingId", "BL-"));

patientBillingSchema.plugin(paginate);

interface PatientBillingDocument extends Document, IPatientBilling {}

export const PatientBilling = mongoose.model<
  PatientBillingDocument,
  PaginateModel<PatientBillingDocument>
>("PatientBilling", patientBillingSchema);
