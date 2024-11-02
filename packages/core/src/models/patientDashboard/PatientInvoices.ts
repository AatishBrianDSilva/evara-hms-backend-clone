import mongoose, { Document, PaginateModel, Schema } from 'mongoose';
import paginate from 'mongoose-paginate-v2';

interface PatientInvoices extends Document {
  clinicId: string;
  branchId: string;
  patient: string;
  doctor: string;
  category: string;
  reportName: string;
  bucket: string;
  key: string;
  source_report_id: string;
}

const PatientInvoicesSchema = new Schema(
  {
    clinicId: { type: String, required: true },
    branchId: { type: String, required: true },
    doctor: { type: String },
    patient: {
      type: Schema.Types.ObjectId,
      ref: 'patients',
      required: true,
      index: true,
    },
    category: { type: String, required: true },
    reportName: { type: String, required: true },
    bucket: { type: String, required: true },
    key: { type: String, required: true },
    source_report_id: { type: String, required: true },
  },
  {
    timestamps: true,
  },
);

PatientInvoicesSchema.index({ clinicId: 1, branchId: 1 });
PatientInvoicesSchema.index({ patient: 1 });

PatientInvoicesSchema.plugin(paginate);

export interface PatientInvoicesDocument extends Document, PatientInvoices {}

const PatientInvoices = mongoose.model<
  PatientInvoicesDocument,
  PaginateModel<PatientInvoicesDocument>
>('patientInvoices', PatientInvoicesSchema);

export default PatientInvoices;
