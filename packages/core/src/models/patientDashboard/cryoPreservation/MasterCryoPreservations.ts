import mongoose, { Document, Schema } from 'mongoose';
import { EGender } from '../investigation/MedicalTests';
import { ECryoPreservationType } from './CryoPreservations';

interface IMasterCryoPreservations extends Document {
  clinicId: string;
  cryoPreservationType: ECryoPreservationType;
  cryoPreservation: mongoose.Schema.Types.ObjectId;
  gender: EGender;
  name: string;
  description?: string;
  cost: number;
  total: number;
  active: boolean;
  validTill: Date;
  isPackageItem: Boolean;
}

const MasterCryoPreservationsSchema: Schema =
  new Schema<IMasterCryoPreservations>({
    clinicId: { type: String, required: true, index: true },
    cryoPreservationType: {
      type: String,
      required: true,
      enum: Object.values(ECryoPreservationType),
    },
    cryoPreservation: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'CryoPreservations',
    },
    name: { type: String, required: true, unique: true },
    gender: { type: String, required: true, enum: Object.values(EGender) },
    description: { type: String },
    cost: { type: Number, required: true },
    total: { type: Number, required: true },
    active: { type: Boolean, required: true, default: true },
    validTill: { type: Date },
    isPackageItem: { type: Boolean, default: false }, // Set default to false
  });

const MasterCryoPreservations = mongoose.model<IMasterCryoPreservations>(
  'MasterCryoPreservations',
  MasterCryoPreservationsSchema,
);

export default MasterCryoPreservations;
