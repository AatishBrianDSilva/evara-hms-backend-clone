import mongoose, { Document, Schema } from "mongoose";

interface ITreatmentCycleResult extends Document {
  cycleName: string;
  details: {
    protocol: [Schema.Types.Mixed];
    checkList: [Schema.Types.Mixed];
    reports: [Schema.Types.Mixed];
    metrics: [Schema.Types.Mixed];
  };
  files?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ITreatmentCycleResultSchema: Schema = new Schema<ITreatmentCycleResult>(
  {
    cycleName: { type: String, required: true },
    details: {
      protocol: { type: [Schema.Types.Mixed] },
      checkList: { type: [Schema.Types.Mixed] },
      reports: { type: [Schema.Types.Mixed] },
      metrics: { type: [Schema.Types.Mixed] },
    },
    files: [String],
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  }
);

interface IPatientTreatmentCycle extends Document {
  clinicId: string;
  branchId?: string;
  patient: mongoose.Schema.Types.ObjectId;
  doctor?: mongoose.Schema.Types.ObjectId;
  patientCode: string;
  cycle: mongoose.Schema.Types.ObjectId;
  result: ITreatmentCycleResult;
  status: string;
  date?: Date;
  caseId?: string;
}

const PatientTreatmentCycleSchema: Schema = new Schema<IPatientTreatmentCycle>(
  {
    clinicId: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
    caseId: { type: String, index: true },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },
    patientCode: { type: String, required: true },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "doctors",
    },
    cycle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MasterTreatmentCycle",
      required: true,
    },
    result: ITreatmentCycleResultSchema,
    date: { type: Date, required: true, default: Date.now },
    status: { type: String, required: true, default: "Scheduled" },
  },
  {
    timestamps: true,
  }
);

const PatientTreatmentCycle = mongoose.model<IPatientTreatmentCycle>(
  "PatientTreatmentCycle",
  PatientTreatmentCycleSchema
);

export default PatientTreatmentCycle;
