import mongoose, { Document, PaginateModel, Schema } from 'mongoose';
import paginate from 'mongoose-paginate-v2';

interface IProcedureResult extends Document {
  procedureName: string;
  details: Schema.Types.Mixed;
  files?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const IProcedureResultSchema: Schema = new Schema<IProcedureResult>(
  {
    procedureName: { type: String, required: true },
    details: { type: Schema.Types.Mixed },
    files: [String],
    notes: String,
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  },
);

interface IPatientProcedure extends Document {
  clinicId: string;
  branchId?: string;
  patient: mongoose.Schema.Types.ObjectId;
  doctor?: mongoose.Schema.Types.ObjectId;
  patientCode: string;
  procedure: mongoose.Schema.Types.ObjectId;
  result: IProcedureResult;
  dateAssigned: Date;
  status: string;
  caseId?: string;
}

const PatientProcedureSchema: Schema = new Schema(
  {
    clinicId: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
    caseId: { type: String, index: true },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    patientCode: { type: String, required: true },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'doctors',
    },
    procedure: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MasterProcedures',
      required: true,
    },
    result: IProcedureResultSchema,
    date: { type: Date, default: Date.now },
    status: { type: String, required: true, default: 'Scheduled' },
  },
  {
    timestamps: true,
  },
);

PatientProcedureSchema.plugin(paginate);

interface PatientProcedureDocument extends Document, IPatientProcedure {}

const PatientProcedures = mongoose.model<
  PatientProcedureDocument,
  PaginateModel<PatientProcedureDocument>
>('PatientProcedures', PatientProcedureSchema);

export default PatientProcedures;
