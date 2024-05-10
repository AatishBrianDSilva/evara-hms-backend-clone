import mongoose, { Schema } from "mongoose";

interface notesObservation {
  name: string;
}

const notesObservationSchema = new Schema<notesObservation>({
  name: { type: String, required: true },
});

const NotesObservation = mongoose.model<notesObservation>(
  "NotesObservation",
  notesObservationSchema
);

export default NotesObservation;
