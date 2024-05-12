import mongoose, { Document, Schema } from "mongoose";
import { EGender } from "../investigation/MedicalTests";
import { ECryoPreservationType } from "./CryoPreservations";

interface IMasterCryoPreservations extends Document {
  cryoPreservationType: ECryoPreservationType;
  cryoPreservation: mongoose.Schema.Types.ObjectId;
  gender: EGender;
  name: string;
  description?: string;
  cost: number;
  tax: number;
  total: number;
  active: boolean;
  validTill: Date;
}

const MasterCryoPreservationsSchema: Schema =
  new Schema<IMasterCryoPreservations>({
    cryoPreservationType: {
      type: String,
      required: true,
      enum: Object.values(ECryoPreservationType),
    },
    cryoPreservation: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "CryoPreservations",
    },
    name: { type: String, required: true, unique: true },
    gender: { type: String, required: true, enum: Object.values(EGender) },
    description: { type: String },
    cost: { type: Number, required: true },
    tax: { type: Number, required: true },
    total: { type: Number, required: true },
    active: { type: Boolean, required: true, default: true },
    validTill: { type: Date },
  });

const MasterCryoPreservations = mongoose.model<IMasterCryoPreservations>(
  "MasterCryoPreservations",
  MasterCryoPreservationsSchema
);

export default MasterCryoPreservations;
