import mongoose, { Document, Schema } from "mongoose";
import { EGender } from "../investigation/MedicalTests";
import { EProcedureType } from "./MedicalProcedure";

interface IMasterProcedures extends Document {
  procedureType: EProcedureType;
  procedure: mongoose.Schema.Types.ObjectId;
  gender: EGender;
  name: string;
  description?: string;
  cost: number;
  active: boolean;
}

const MasterProcedureSchema: Schema = new Schema({
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
  name: { type: String, required: true },
  gender: { type: String, required: true, enum: Object.values(EGender) },
  description: { type: String },
  cost: { type: Number, required: true },
  active: { type: Boolean, required: true, default: true },
});

const MasterProcedure = mongoose.model<IMasterProcedures>(
  "MasterProcedures",
  MasterProcedureSchema
);

export default MasterProcedure;
