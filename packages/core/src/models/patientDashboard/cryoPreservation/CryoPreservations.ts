import mongoose, { Document, Mixed, Schema } from 'mongoose';
import { autoIncrementId } from '../../Counters';
import { EGender } from '../investigation/MedicalTests';

export enum ECryoPreservationType {
  Embryo = 'Embryo',
  Sperm = 'Sperm',
}

interface ICryoPreservations extends Document {
  cryoPreservationId: string;
  cryoPreservationName: string;
  cryoPreservationType: ECryoPreservationType;
  description: string;
  gender: EGender;
}

const CryoPreservationSchema: Schema = new Schema<ICryoPreservations>(
  {
    cryoPreservationId: { type: String, unique: true },
    cryoPreservationName: { type: String, required: true },
    cryoPreservationType: {
      type: String,
      enum: Object.values(ECryoPreservationType),
      required: true,
    },
    description: { type: String, required: true },
    gender: { type: String, required: true, enum: Object.values(EGender) },
  },
  {
    timestamps: true,
  },
);

// Assume autoIncrementId is a function/middleware you've defined to auto-increment the testId
CryoPreservationSchema.pre(
  'save',
  autoIncrementId('CryoPreservations', 'cryoPreservationId', 'CP-'),
);

const CryoPreservations = mongoose.model<ICryoPreservations>(
  'CryoPreservations',
  CryoPreservationSchema,
);

export default CryoPreservations;
