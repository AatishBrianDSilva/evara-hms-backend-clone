import mongoose, { Schema } from "mongoose";

interface notesObservation {
  name: string;
  clinicId: string;
  branchId: string;
}

const notesObservationSchema = new Schema<notesObservation>(
  {
    name: { type: String, required: true },
    clinicId: { type: String, required: true },
    branchId: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

const NotesObservation = mongoose.model<notesObservation>(
  "NotesObservation",
  notesObservationSchema
);

export default NotesObservation;
