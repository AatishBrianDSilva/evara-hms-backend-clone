import mongoose, { Document } from "mongoose";

interface ITreatmentCycleStage extends Document {
  name: string;
  clinicId: string;
}

const TreatmentCycleStageSchema = new mongoose.Schema<ITreatmentCycleStage>(
  {
    name: { type: String, required: true },
    clinicId: { type: String, required: true, index: true },
  },
  {
    timestamps: true,
  }
);

export const TreatmentCycleStage = mongoose.model<ITreatmentCycleStage>(
  "TreatmentCycleStage",
  TreatmentCycleStageSchema
);
