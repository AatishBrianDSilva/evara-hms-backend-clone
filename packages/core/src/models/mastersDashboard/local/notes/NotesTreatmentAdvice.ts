import mongoose, { Schema } from "mongoose";

interface notesTreatmentAdvice {
  name: string;
  clinicId: string;
  branchId: string;
}

const notesTreatmentAdviceSchema = new Schema<notesTreatmentAdvice>(
  {
    name: { type: String, required: true },
    clinicId: { type: String, required: true },
    branchId: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

const NotesTreatmentAdvice = mongoose.model<notesTreatmentAdvice>(
  "NotesTreatmentAdvice",
  notesTreatmentAdviceSchema
);

export default NotesTreatmentAdvice;
