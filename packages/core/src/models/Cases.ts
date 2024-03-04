import mongoose, { Document, PaginateModel, Types } from "mongoose";
import paginate from "mongoose-paginate-v2";
import { autoIncrementId } from "./Counters";

interface CasesData extends Document {
  caseId: string;
  patientId: string;
  partnerId: string;
  status: "active" | "inactive";
}

export const casesSchema = new mongoose.Schema(
  {
    caseId: { type: String },
    patientId: { type: String, required: true, unique: true },
    partnerId: { type: String },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  {
    timestamps: true,
  }
);

casesSchema.index({ caseId: 1, patientId: 1 }, { unique: true });

casesSchema.pre("save", autoIncrementId("cases", "caseId", "CA-"));

casesSchema.plugin(paginate);

interface CaseDocument extends mongoose.Document, CasesData {}

const Patient = mongoose.model<CaseDocument, PaginateModel<CaseDocument>>(
  "cases",
  casesSchema
);

export default Patient;
