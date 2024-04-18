import mongoose, { Document, Schema } from "mongoose";

interface PatientHistoryData extends Document {
  patientId: Schema.Types.ObjectId;
  patientCode: string;
  clinicId: string;
  branchId: string;
  medicalHistory: any;
  menstrualAndOvulationHistory: any;
  coitalHistory: any;
  diseaseAdverseEffect: any;
  otherFactorsAdverseEffect: any;
  generalPhysicalExamination: any;
  investigations: any;
  summary: any;
  files: string[];
}

const patientHiatorySchema = new mongoose.Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: "patients", required: true },
    patientCode: { type: String, required: true },
    clinicId: { type: String, required: true },
    branchId: { type: String, required: true },
    medicalHistory: { type: Object },
    menstrualAndOvulationHistory: { type: Object },
    coitalHistory: { type: Object },
    diseaseAdverseEffect: { type: Object },
    otherFactorsAdverseEffect: { type: Object },
    generalPhysicalExamination: { type: Object },
    investigations: { type: Object },
    summary: { type: Object },
    files: { type: [String] },
  },
  {
    timestamps: true,
  }
);

patientHiatorySchema.index({ patientId: 1 });
patientHiatorySchema.index({ patientCode: 1 });
patientHiatorySchema.index({ clinicId: 1 });
patientHiatorySchema.index({ branchId: 1, clinicId: 1 });

export const PatientHistory = mongoose.model<PatientHistoryData>(
  "PatientHistory",
  patientHiatorySchema
);
