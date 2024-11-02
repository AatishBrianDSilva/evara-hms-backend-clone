import mongoose, { Schema } from 'mongoose';

interface patientIdType {
  name: string;
  format: string;
  clinicId: string;
  branchId: string;
}

const patientIdTypeSchema = new Schema<patientIdType>(
  {
    clinicId: { type: String, required: true },
    branchId: { type: String, required: true },
    name: { type: String, required: true },
    format: { type: String },
  },
  {
    timestamps: true,
  },
);

const PatientIdType = mongoose.model<patientIdType>(
  'PatientIdType',
  patientIdTypeSchema,
);

export default PatientIdType;
