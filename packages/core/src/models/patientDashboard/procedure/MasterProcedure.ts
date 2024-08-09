import mongoose, { Document, Schema } from "mongoose";
import { EGender } from "../investigation/MedicalTests";
import { EProcedureType } from "./MedicalProcedure";

interface IMasterProcedures extends Document {
  clinicId: string;
  procedureType: EProcedureType;
  procedure: mongoose.Schema.Types.ObjectId;
  gender: EGender;
  name: string;
  description?: string;
  cost: number;
  total: number;
  active: boolean;
  validTill: Date;
}

const MasterProcedureSchema: Schema = new Schema({
  clinicId: { type: String, required: true, index: true },
  procedureType: {
    type: String,
    required: true,
    enum: Object.values(EProcedureType),
  },
  procedure: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "MedicalProcedures",
  },
  name: { type: String, required: true, unique: true },
  gender: { type: String, required: true, enum: Object.values(EGender) },
  description: { type: String },
  cost: { type: Number, required: true },
  total: { type: Number, required: true },
  active: { type: Boolean, required: true, default: true },
  validTill: { type: Date },
});

const MasterProcedure = mongoose.model<IMasterProcedures>(
  "MasterProcedures",
  MasterProcedureSchema
);

export default MasterProcedure;
