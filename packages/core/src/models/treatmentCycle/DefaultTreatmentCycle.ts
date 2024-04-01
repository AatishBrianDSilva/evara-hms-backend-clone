import mongoose, { Document, Mixed, Schema } from "mongoose";
import { autoIncrementId } from "../Counters";
import { EGender } from "../investigation/MedicalTests";

export enum ETreatmentCycleType {
  IUI = "IUI",
  OITI = "OITI",
  IVFPlusFET = "IVFPlusFET",
  IVFWithDonorEgg = "IVFWithDonorEgg",
  ICSIWithDonorEgg = "ICSIWithDonorEgg",
  IVFPlusFETNoGrowthHormone = "IVFPlusFETNoGrowthHormone",
}

interface IDefaultTreatmentCycle extends Document {
  cycleId: string;
  cycleName: string;
  cycleType: ETreatmentCycleType;
  description: string;
  gender: EGender;
}

const DefaultTreatmentCycleSchema: Schema = new Schema<IDefaultTreatmentCycle>(
  {
    cycleId: { type: String, unique: true },
    cycleName: { type: String, required: true },
    cycleType: {
      type: String,
      enum: Object.values(ETreatmentCycleType),
      required: true,
    },
    description: { type: String, required: true },
    gender: { type: String, required: true, enum: Object.values(EGender) },
  },
  {
    timestamps: true,
  }
);

// Assume autoIncrementId is a function/middleware you've defined to auto-increment the testId
DefaultTreatmentCycleSchema.pre(
  "save",
  autoIncrementId("DefaultTreatmentCycle", "cycleId", "TC-")
);

const DefaultTreatmentCycle = mongoose.model<IDefaultTreatmentCycle>(
  "DefaultTreatmentCycle",
  DefaultTreatmentCycleSchema
);

export default DefaultTreatmentCycle;
