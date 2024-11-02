import mongoose, { Document, PaginateModel, Schema } from 'mongoose';
import paginate from 'mongoose-paginate-v2';

interface IPatientService extends Document {
  clinicId: string;
  branchId?: string;
  patient: mongoose.Schema.Types.ObjectId;
  doctor?: mongoose.Schema.Types.ObjectId;
  patientCode: string;
  service: mongoose.Schema.Types.ObjectId;
  dateAssigned: Date;
  caseId?: string;
}

const PatientServiceSchema: Schema = new Schema(
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
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MasterService',
      required: true,
    },
    date: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
);

PatientServiceSchema.plugin(paginate);

interface PatientServiceDocument extends Document, IPatientService {}

const PatientService = mongoose.model<
  PatientServiceDocument,
  PaginateModel<PatientServiceDocument>
>('PatientService', PatientServiceSchema);

export default PatientService;
