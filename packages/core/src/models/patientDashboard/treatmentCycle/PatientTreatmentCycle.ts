import mongoose, { Document, Schema } from 'mongoose';
import {
  ETreatmentCycleCategoryKey,
  ETreatmentCycleMetric,
  ETreatmentCycleReport,
} from './DefaultTreatmentCycle';

interface IPatientTreatmentCycle extends Document {
  clinicId: string;
  branchId?: string;
  patient: mongoose.Schema.Types.ObjectId;
  cycleNo: number;
  doctor?: mongoose.Schema.Types.ObjectId;
  patientCode: string;
  cycle: mongoose.Schema.Types.ObjectId;
  protocols: [
    {
      name: string;
      status: string;
      details: mongoose.Schema.Types.Mixed;
    },
  ];
  checklists: [
    {
      name: string;
      status: string;
      details: mongoose.Schema.Types.Mixed;
    },
  ];
  reports: [
    {
      name: string;
      reportType: ETreatmentCycleReport;
      status: string;
      details: mongoose.Schema.Types.Mixed;
    },
  ];
  metrics: [
    {
      name: string;
      metricType: ETreatmentCycleMetric;
      status: string;
      details: mongoose.Schema.Types.Mixed;
    },
  ];
  files: [string];
  status: string;
  date?: Date;
  caseId?: string;
}

const PatientTreatmentCycleSchema: Schema = new Schema<IPatientTreatmentCycle>(
  {
    clinicId: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
    caseId: { type: String, index: true },
    cycleNo: { type: Number, required: true },
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
    cycle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MasterTreatmentCycle',
      required: true,
    },
    protocols: [
      {
        name: { type: String, required: true },
        status: { type: String, required: true, default: 'Pending' },
        category: {
          type: String,
          required: true,
          enum: Object.values(ETreatmentCycleCategoryKey),
        },
        details: { type: mongoose.Schema.Types.Mixed },
      },
    ],
    checklists: [
      {
        name: { type: String, required: true },
        status: { type: String, required: true, default: 'Pending' },
        category: {
          type: String,
          required: true,
          enum: Object.values(ETreatmentCycleCategoryKey),
        },
        details: { type: mongoose.Schema.Types.Mixed },
      },
    ],
    reports: [
      {
        name: { type: String, required: true },
        reportType: {
          type: String,
          required: true,
          enum: Object.values(ETreatmentCycleReport),
        },
        status: { type: String, required: true, default: 'Pending' },
        category: {
          type: String,
          required: true,
          enum: Object.values(ETreatmentCycleCategoryKey),
        },
        details: { type: mongoose.Schema.Types.Mixed },
      },
    ],
    metrics: [
      {
        name: { type: String, required: true },
        metricType: {
          type: String,
          required: true,
          enum: Object.values(ETreatmentCycleMetric),
        },
        status: { type: String, required: true, default: 'Pending' },
        category: {
          type: String,
          required: true,
          enum: Object.values(ETreatmentCycleCategoryKey),
        },
        details: { type: mongoose.Schema.Types.Mixed },
      },
    ],
    files: [{ type: String }],
    date: { type: Date, required: true, default: Date.now },
    status: { type: String, required: true, default: 'Scheduled' },
  },
  {
    timestamps: true,
  },
);

const PatientTreatmentCycle = mongoose.model<IPatientTreatmentCycle>(
  'PatientTreatmentCycle',
  PatientTreatmentCycleSchema,
);

export default PatientTreatmentCycle;
