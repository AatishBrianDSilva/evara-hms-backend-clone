import mongoose, { Document, Schema } from 'mongoose';
import { EGender, ETestType } from './MedicalTests';

interface IMasterInvestigation extends Document {
  clinicId: string;
  branchId: string;
  testType: ETestType;
  test: mongoose.Schema.Types.ObjectId;
  gender: EGender;
  name: string;
  description?: string;
  cost: number;
  total: number;
  active: boolean;
  validTill: Date;
  isPackageItem: Boolean;
}

const MasterInvestigationSchema: Schema = new Schema({
  clinicId: { type: String, required: true, index: true },
  branchId: { type: String, required: true, index: true },
  testType: {
    type: String,
    required: true,
    enum: Object.values(ETestType),
  },
  test: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'MedicalTests',
  },
  name: { type: String, required: true },
  gender: { type: String, required: true, enum: Object.values(EGender) },
  description: { type: String },
  cost: { type: Number, required: true },
  total: { type: Number, required: true },
  active: { type: Boolean, required: true, default: true },
  validTill: { type: Date },
  isPackageItem: { type: Boolean, default: false }, // Set default to false
});

const MasterInvestigation = mongoose.model<IMasterInvestigation>(
  'MasterInvestigations',
  MasterInvestigationSchema,
);

export default MasterInvestigation;
