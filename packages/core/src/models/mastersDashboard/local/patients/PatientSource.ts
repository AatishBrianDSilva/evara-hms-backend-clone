import mongoose, { Schema } from "mongoose";

interface patientSource {
  name: string;
  clinicId: string;
  branchId: string;
}

const patientSourceSchema = new Schema<patientSource>(
  {
    name: { type: String, required: true },
    clinicId: { type: String, required: true },
    branchId: { type: String, required: true },
  },
  { timestamps: true }
);

const PatientSource = mongoose.model<patientSource>(
  "PatientSource",
  patientSourceSchema
);

export default PatientSource;
