import mongoose, { Document, Schema } from "mongoose";
import { autoIncrementId } from "../../Counters";
import { EGender } from "../investigation/MedicalTests";

export enum ETreatmentCycleType {
  IUI = "IUI",
  OITI = "OITI",
  IVFPlusFET = "IVFPlusFET",
  IVFWithDonorEgg = "IVFWithDonorEgg",
  ICSIWithDonorEgg = "ICSIWithDonorEgg",
  IVFPlusFETNoGrowthHormone = "IVFPlusFETNoGrowthHormone",
}

export enum ETreatmentCycleReport {
  IUIHReport = "IUIHReport",
  IUIDReport = "IUIDReport",
  OITIReport = "OITIReport",
  OPUReport = "OPUReport",
  EmbryoTransferReport = "EmbryoTransferReport",
  IVFSummaryReport = "IVFSummaryReport",
}

export enum ETreatmentCycleMetric {
  PregnancyOutcomeBetaHCGMetric = "PregnancyOutcomeBetaHCGMetric",
  EmbryologyWorksheetMetric = "EmbryologyWorksheetMetric",
}

export enum ETreatmentCycleCategoryKey {
  protocols = "protocols",
  checklists = "checklists",
  reports = "reports",
  metrics = "metrics",
}

export interface IDefaultTreatmentCycle extends Document {
  cycleId: string;
  cycleName: string;
  cycleType: ETreatmentCycleType;
  protocols: [
    {
      name: string;
      category: ETreatmentCycleCategoryKey;
    }
  ];
  checklists: [
    {
      name: string;
      category: ETreatmentCycleCategoryKey;
    }
  ];
  reports: [
    {
      name: string;
      reportType: ETreatmentCycleReport;
      category: ETreatmentCycleCategoryKey;
    }
  ];
  metrics: [
    {
      name: string;
      metricType: ETreatmentCycleMetric;
      category: ETreatmentCycleCategoryKey;
    }
  ];
  description: string;
  gender: EGender;
}

const DefaultTreatmentCycleSchema: Schema = new Schema<IDefaultTreatmentCycle>(
  {
    cycleId: { type: String, unique: true },
    cycleName: { type: String, required: true },
    cycleType: {
      type: String,
      enum: Object.values(ETreatmentCycleType),
      required: true,
    },
    description: { type: String, required: true },
    gender: { type: String, required: true, enum: Object.values(EGender) },
    protocols: [
      {
        name: { type: String, required: true },
        category: {
          type: String,
          required: true,
          enum: Object.values(ETreatmentCycleCategoryKey),
        },
      },
    ],
    checklists: [
      {
        name: { type: String, required: true },
        category: {
          type: String,
          required: true,
          enum: Object.values(ETreatmentCycleCategoryKey),
        },
      },
    ],
    reports: [
      {
        name: { type: String, required: true },
        reportType: {
          type: String,
          enum: Object.values(ETreatmentCycleReport),
        },
        category: {
          type: String,
          required: true,
          enum: Object.values(ETreatmentCycleCategoryKey),
        },
      },
    ],
    metrics: [
      {
        name: { type: String, required: true },
        metricType: {
          type: String,
          enum: Object.values(ETreatmentCycleMetric),
        },
        category: {
          type: String,
          required: true,
          enum: Object.values(ETreatmentCycleCategoryKey),
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Assume autoIncrementId is a function/middleware you've defined to auto-increment the testId
DefaultTreatmentCycleSchema.pre(
  "save",
  autoIncrementId("DefaultTreatmentCycle", "cycleId", "TC-")
);

const DefaultTreatmentCycle = mongoose.model<IDefaultTreatmentCycle>(
  "DefaultTreatmentCycle",
  DefaultTreatmentCycleSchema
);

export default DefaultTreatmentCycle;
