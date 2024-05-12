import mongoose, { Document, Schema } from "mongoose";

interface PatientNotes extends Document {
  observations: string[];
  medications: string[];
  investigations: string[];
  scans: string[];
  treatmentAdvices: string[];
  notes: string;
  doctor: Schema.Types.ObjectId;
  patient: Schema.Types.ObjectId;
}

const patientNotesSchema = new Schema(
  {
    observations: { type: [String], default: [] },
    medications: { type: [String], default: [] },
    investigations: { type: [String], default: [] },
    scans: { type: [String], default: [] },
    treatmentAdvices: { type: [String], default: [] },
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
