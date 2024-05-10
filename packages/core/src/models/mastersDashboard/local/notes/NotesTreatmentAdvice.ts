import mongoose, { Schema } from "mongoose";

interface notesTreatmentAdvice {
  name: string;
}

const notesTreatmentAdviceSchema = new Schema<notesTreatmentAdvice>({
  name: { type: String, required: true },
});

const NotesTreatmentAdvice = mongoose.model<notesTreatmentAdvice>(
  "NotesTreatmentAdvice",
  notesTreatmentAdviceSchema
);

export default NotesTreatmentAdvice;
