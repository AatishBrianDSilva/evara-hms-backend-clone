import mongoose, { Document, PaginateModel, Schema } from 'mongoose';
import paginate from 'mongoose-paginate-v2';
import { autoIncrementId } from '../Counters';

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
    notes?: string; // Optional notes field for each item
    patientId?: string;
  }[];
  createdBy: string;
  report?: {
    reportName: string;
    bucket: string;
    key: string;
  }; // Field for storing PDF report information
}

const itemSchema = new Schema({
  item: { type: Schema.Types.ObjectId, ref: 'PharmacyStock', required: true },
  quantity: { type: Number, required: true, min: 1 },
  batches: [internalConsumptionBatchDetailSchema],
  transferFrom: {
    location: {
      type: Schema.Types.ObjectId,
      ref: 'DrugLocation',
      required: true,
    },
    quantity: { type: Number, required: true },
  },
  notes: { type: String, required: false },
  patientId: { type: String, ref: 'patients' },
});

const internalConsumptionSchema = new Schema(
  {
    clinicId: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    icNumber: { type: String, unique: true, index: true },
    date: { type: Date, required: true },
    items: [itemSchema],
    createdBy: { type: String, required: true },
    report: {
      reportName: { type: String, required: false },
      bucket: { type: String, required: false },
      key: { type: String, required: false },
    },
  },
  { timestamps: true },
);

internalConsumptionSchema.index({ createdBy: 1 });

// Auto-increment logic for icNumber field
internalConsumptionSchema.pre(
  'save',
  autoIncrementId('InternalConsumption', 'icNumber', 'IC-'),
);

internalConsumptionSchema.plugin(paginate);

export interface IInternalConsumptionDocument
  extends Document,
    IInternalConsumption {}

export const InternalConsumption = mongoose.model<
  IInternalConsumptionDocument,
  PaginateModel<IInternalConsumptionDocument>
>('InternalConsumption', internalConsumptionSchema);
