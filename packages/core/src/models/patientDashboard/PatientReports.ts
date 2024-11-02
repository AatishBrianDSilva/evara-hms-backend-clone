import mongoose, { Document, PaginateModel, Schema } from 'mongoose';
import paginate from 'mongoose-paginate-v2';

interface PatientReports extends Document {
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

const PatientReportsSchema = new Schema(
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

PatientReportsSchema.index({ clinicId: 1, branchId: 1 });
PatientReportsSchema.index({ patient: 1 });

PatientReportsSchema.plugin(paginate);

export interface PatientReportsDocument extends Document, PatientReports {}

const PatientReports = mongoose.model<
  PatientReportsDocument,
  PaginateModel<PatientReportsDocument>
>('PatientReports', PatientReportsSchema);

export default PatientReports;
