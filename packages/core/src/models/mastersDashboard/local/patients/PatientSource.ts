import mongoose, { Schema } from "mongoose";

interface patientSource {
  name: string;
}

const patientSourceSchema = new Schema<patientSource>({
  name: { type: String, required: true },
});

const PatientSource = mongoose.model<patientSource>(
  "PatientSource",
  patientSourceSchema
);

export default PatientSource;
