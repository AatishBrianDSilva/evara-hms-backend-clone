import mongoose, { Document } from "mongoose";

interface ITreatmentCycleStage extends Document {
  name: string;
}

const TreatmentCycleStageSchema = new mongoose.Schema<ITreatmentCycleStage>(
  {
    name: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

export const TreatmentCycleStage = mongoose.model<ITreatmentCycleStage>(
  "TreatmentCycleStage",
  TreatmentCycleStageSchema
);
