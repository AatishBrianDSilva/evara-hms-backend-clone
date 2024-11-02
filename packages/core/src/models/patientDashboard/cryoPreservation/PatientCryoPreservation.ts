import mongoose, { Document, PaginateModel, Schema } from 'mongoose';
import paginate from 'mongoose-paginate-v2';

interface ICryoPreservationDetails extends Document {
  cryoPreservationName: string;
  details: Schema.Types.Mixed;
  files?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ICryoPreservationDetailsSchema: Schema =
  new Schema<ICryoPreservationDetails>(
    {
      cryoPreservationName: { type: String, required: true },
      details: { type: Schema.Types.Mixed },
      files: [String],
      notes: String,
    },
    {
      timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    },
  );

interface IPatientCryoPreservation extends Document {
  clinicId: string;
  branchId?: string;
  patient: mongoose.Schema.Types.ObjectId;
  doctor?: mongoose.Schema.Types.ObjectId;
  patientCode: string;
  cryo: mongoose.Schema.Types.ObjectId;
  details: ICryoPreservationDetails;
  date: Date;
  status: string;
  caseId?: string;
}

const PatientCryoPreservationSchema: Schema =
  new Schema<IPatientCryoPreservation>(
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
      cryo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MasterProcedures',
        required: true,
      },
      details: ICryoPreservationDetailsSchema,
      date: { type: Date, default: Date.now },
      status: { type: String, required: true, default: 'Scheduled' },
    },
    {
      timestamps: true,
    },
  );

PatientCryoPreservationSchema.plugin(paginate);

interface PatientCryoPreservationDocument
  extends Document,
    IPatientCryoPreservation {}

const PatientCryoPreservation = mongoose.model<
  PatientCryoPreservationDocument,
  PaginateModel<PatientCryoPreservationDocument>
>('PatientCryoPreservation', PatientCryoPreservationSchema);

export default PatientCryoPreservation;
