import mongoose, { Schema } from "mongoose";

interface patientIdType {
  name: string;
  format: string;
}

const patientIdTypeSchema = new Schema<patientIdType>({
  name: { type: String, required: true },
  format: { type: String },
});

const PatientIdType = mongoose.model<patientIdType>(
  "PatientIdType",
  patientIdTypeSchema
);

export default PatientIdType;
