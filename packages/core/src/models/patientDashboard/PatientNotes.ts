import mongoose, { Document, Schema } from "mongoose";

interface PatientNotes extends Document {
  clinicId: string;
  branchId: string;
  observations: string[];
  observationNotes: string;
  medications: string[];
  medicationsNotes: string;
  investigations: string[];
  investigationsNotes: string;
  scans: string[];
  scansNotes: string;
  treatmentAdvices: string[];
  treatmentAdvicesNotes: string;
  notes: string;
  doctor: Schema.Types.ObjectId;
  patient: Schema.Types.ObjectId;
}

const patientNotesSchema = new Schema(
  {
    clinicId: { type: String, required: true },
    branchId: { type: String, required: true },
    observations: { type: [String], default: [] },
    observationNotes: { type: String, default: "" },
    medications: { type: [String], default: [] },
    medicationsNotes: { type: String, default: "" },
    investigations: { type: [String], default: [] },
    investigationsNotes: { type: String, default: "" },
    scans: { type: [String], default: [] },
    scansNotes: { type: String, default: "" },
    treatmentAdvices: { type: [String], default: [] },
    treatmentAdvicesNotes: { type: String, default: "" },
    notes: { type: String, default: "" },
    doctor: {
      type: Schema.Types.ObjectId,
      ref: "doctors",
      required: true,
      index: true,
    },
    patient: {
      type: Schema.Types.ObjectId,
      ref: "patients",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const PatientNotes = mongoose.model<PatientNotes>(
  "patientNotes",
  patientNotesSchema
);

export default PatientNotes;
