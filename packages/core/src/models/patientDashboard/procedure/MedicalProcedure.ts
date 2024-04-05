import mongoose, { Document, Mixed, Schema } from "mongoose";
import { autoIncrementId } from "../../Counters";
import { EGender } from "../investigation/MedicalTests";

export enum EProcedureType {
  Hysteroscopy = "Hysteroscopy",
  Laparoscopy = "Laparoscopy",
  TESA = "TESA",
  TESE = "TESE",
  PGT = "PGT",
  ERA = "ERA",
}

interface IMedicalProcedure extends Document {
  procedureId: string;
  procedureName: string;
  procedureType: EProcedureType;
  description: string;
  gender: EGender;
}

const MedicalProcedureSchema: Schema = new Schema(
  {
    procedureId: { type: String, unique: true },
    procedureName: { type: String, required: true },
    procedureType: {
      type: String,
      enum: Object.values(EProcedureType),
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
MedicalProcedureSchema.pre(
  "save",
  autoIncrementId("MedicalProcedures", "procedureId", "P-")
);

const MedicalProcedure = mongoose.model<IMedicalProcedure>(
  "MedicalProcedures",
  MedicalProcedureSchema
);

export default MedicalProcedure;
