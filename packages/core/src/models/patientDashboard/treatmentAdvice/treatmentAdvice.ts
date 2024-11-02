import mongoose, { Document, PaginateModel, Schema } from 'mongoose';
import paginate from 'mongoose-paginate-v2';

interface ICallDetail {
  callDate: Date;
  callTime: Date;
  comments: string;
}

interface ITreatmentAdvice extends Document {
  treatmentAdvice: string;
  tentativeDate: Date;
  status: string;
  comments: string;
  callDetails: ICallDetail[];
  patient: mongoose.Schema.Types.ObjectId;
  caseId: string;
  patientCode: string;
  createdAt: Date;
  updatedAt: Date;
}

const CallDetailSchema: Schema = new Schema<ICallDetail>({
  callDate: { type: Date, required: true },
  callTime: { type: Date, required: true },
  comments: { type: String },
});

const TreatmentAdviceSchema: Schema = new Schema<ITreatmentAdvice>(
  {
    treatmentAdvice: { type: String, required: true },
    tentativeDate: { type: Date, required: true },
    status: { type: String },
    comments: { type: String },
    callDetails: { type: [CallDetailSchema], required: true },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    caseId: { type: String, required: true, index: true },
    patientCode: { type: String, required: true, index: true },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  },
);

TreatmentAdviceSchema.plugin(paginate);

interface TreatmentAdviceDocument extends Document, ITreatmentAdvice {}

const TreatmentAdvices = mongoose.model<
  TreatmentAdviceDocument,
  PaginateModel<TreatmentAdviceDocument>
>('TreatmentAdvices', TreatmentAdviceSchema);

export default TreatmentAdvices;
