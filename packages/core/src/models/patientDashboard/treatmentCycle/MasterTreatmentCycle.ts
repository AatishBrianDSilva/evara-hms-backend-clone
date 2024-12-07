import mongoose, { Document, Schema } from 'mongoose';
import {
  ETreatmentCycleType,
  IDefaultTreatmentCycle,
} from './DefaultTreatmentCycle';
import { EGender } from '../investigation/MedicalTests';

interface IMasterTreatmentCycle extends Document {
  clinicId: string;
  branchId: string;
  cycleType: ETreatmentCycleType;
  treatmentCycle: IDefaultTreatmentCycle;
  gender: EGender;
  name: string;
  description?: string;
  cost: number;
  active: boolean;
  total: number;
  validTill: Date;
  isPackageItem: Boolean;
}

const MasterTreatmentCycleSchema: Schema = new Schema({
  clinicId: { type: String, required: true, index: true },
  branchId: { type: String, required: true, index: true },
  cycleType: {
    type: String,
    required: true,
    enum: Object.values(ETreatmentCycleType),
  },
  treatmentCycle: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'DefaultTreatmentCycle',
  },
  name: { type: String, required: true },
  gender: { type: String, required: true, enum: Object.values(EGender) },
  description: { type: String },
  cost: { type: Number, required: true },
  active: { type: Boolean, required: true, default: true },
  total: { type: Number, required: true },
  validTill: { type: Date },
  isPackageItem: { type: Boolean, default: false }, // Set default to false
});

const MasterTreatmentCycle = mongoose.model<IMasterTreatmentCycle>(
  'MasterTreatmentCycle',
  MasterTreatmentCycleSchema,
);

export default MasterTreatmentCycle;
