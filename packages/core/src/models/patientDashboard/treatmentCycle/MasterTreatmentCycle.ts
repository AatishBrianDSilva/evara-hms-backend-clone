import mongoose, { Document, Schema } from "mongoose";
import {
  ETreatmentCycleType,
  IDefaultTreatmentCycle,
} from "./DefaultTreatmentCycle";
import { EGender } from "../investigation/MedicalTests";

interface IMasterTreatmentCycle extends Document {
  cycleType: ETreatmentCycleType;
  treatmentCycle: IDefaultTreatmentCycle;
  gender: EGender;
  name: string;
  description?: string;
  cost: number;
  active: boolean;
  tax: number;
  total: number;
  validTill: Date;
}

const MasterTreatmentCycleSchema: Schema = new Schema({
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
  name: { type: String, required: true, unique: true },
  gender: { type: String, required: true, enum: Object.values(EGender) },
  description: { type: String },
  cost: { type: Number, required: true },
  tax: { type: Number, required: true },
  active: { type: Boolean, required: true, default: true },
  total: { type: Number, required: true },
  validTill: { type: Date },
});

const MasterTreatmentCycle = mongoose.model<IMasterTreatmentCycle>(
  "MasterTreatmentCycle",
  MasterTreatmentCycleSchema
);

export default MasterTreatmentCycle;
