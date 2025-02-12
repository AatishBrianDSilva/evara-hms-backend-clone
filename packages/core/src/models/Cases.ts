import mongoose, { Document, PaginateModel, Types } from 'mongoose';
import paginate from 'mongoose-paginate-v2';
import { autoIncrementCaseId, autoIncrementId } from './Counters';

interface CasesData extends Document {
  caseId: string;
  patientId: string;
  partnerId: string;
  clinicId: string;
  branchId: string;
  donorId: string;
  status: 'active' | 'inactive';
}

export const casesSchema = new mongoose.Schema(
  {
    caseId: { type: String },
    patientId: { type: String, required: true, unique: true },
    clinicId: { type: String, required: true },
    branchId: { type: String, required: true },
    partnerId: { type: String },
    donorId: { type: String },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  {
    timestamps: true,
  },
);

casesSchema.index({ caseId: 1, patientId: 1 }, { unique: true });

casesSchema.pre(
  'save',
  autoIncrementCaseId('cases', 'caseId', 'clinicId', 'branchId'),
);

casesSchema.plugin(paginate);

interface CaseDocument extends mongoose.Document, CasesData {}

const Cases = mongoose.model<CaseDocument, PaginateModel<CaseDocument>>(
  'cases',
  casesSchema,
);

export default Cases;
