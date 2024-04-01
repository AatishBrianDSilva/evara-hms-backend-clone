import mongoose, { Document, Schema } from "mongoose";
import { ETreatmentCycleType } from "./DefaultTreatmentCycle";
import { EGender } from "../investigation/MedicalTests";

interface IMasterTreatmentCycle extends Document {
  cycleType: ETreatmentCycleType;
  treatmentCycle: mongoose.Schema.Types.ObjectId;
  gender: EGender;
  name: string;
  description?: string;
  cost: number;
  active: boolean;
}

const MasterTreatmentCycleSchema: Schema = new Schema<IMasterTreatmentCycle>({
  cycleType: {
    type: String,
    required: true,
    enum: Object.values(ETreatmentCycleType),
  },
  treatmentCycle: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "DefaultTreatmentCycle",
  },
  name: { type: String, required: true },
  gender: { type: String, required: true, enum: Object.values(EGender) },
  description: { type: String },
  cost: { type: Number, required: true },
  active: { type: Boolean, required: true, default: true },
});

const MasterTreatmentCycle = mongoose.model<IMasterTreatmentCycle>(
  "MasterTreatmentCycle",
  MasterTreatmentCycleSchema
);

export default MasterTreatmentCycle;
