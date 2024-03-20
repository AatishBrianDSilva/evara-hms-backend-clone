import mongoose, { Document, Mixed, Schema } from "mongoose";
import { autoIncrementId } from "./Counters";

export enum ETestType {
  BloodTest = "BloodTest",
  UltrasoundScan = "UltrasoundScan",
  BaseLineFollicularMonitoring = "BaseLineFollicularMonitoring",
  EndometrialAssessment = "EndometrialAssessment",
  EarlyPregnancyScan = "EarlyPregnancyScan",
  SemenAnalysis = "SemenAnalysis",
  SpermDFI = "SpermDFI",
}

export enum EGender {
  Male = "male",
  Female = "female",
  Both = "both",
}

enum EBloodTestComponentType {
  Text = "text",
  Select = "select",
}

interface BloodTestComponent {
  componentName: string;
  componentType: EBloodTestComponentType;
  options?: string[]; // For select components
  unit?: string;
  referenceRange?: string;
}

interface IMedicalTest extends Document {
  testId: string;
  testName: string;
  testType: ETestType;
  description: string;
  gender: EGender;
  components?: [BloodTestComponent];
}

export const BloodTestSchema: Schema = new Schema({
  componentName: { type: String, required: true },
  componentType: {
    type: String,
    required: true,
    enum: Object.values(EBloodTestComponentType),
  },
  options: [{ type: String }],
  unit: { type: String },
  referenceRange: { type: String },
});

const MedicalTestSchema: Schema = new Schema(
  {
    testId: { type: String, unique: true },
    testName: { type: String, required: true },
    testType: { type: String, enum: Object.values(ETestType), required: true },
    description: { type: String, required: true },
    gender: { type: String, required: true, enum: Object.values(EGender) },
    components: [BloodTestSchema],
  },
  {
    timestamps: true,
  }
);

// Assume autoIncrementId is a function/middleware you've defined to auto-increment the testId
MedicalTestSchema.pre("save", autoIncrementId("MedicalTests", "testId", "T-"));

const MedicalTest = mongoose.model<IMedicalTest>(
  "MedicalTests",
  MedicalTestSchema
);

export default MedicalTest;

interface IUltraSoundScan extends Document {
  scanType: string;
  LMPDate: Date;
  RequestedDate: Date;
  DateOfScan: Date;
  DayOfCycle: number;
}

export const UltraSoundScan: Schema = new Schema({});
