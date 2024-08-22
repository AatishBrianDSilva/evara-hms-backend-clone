import mongoose, { Document, PaginateModel, Schema } from "mongoose";
import paginate from "mongoose-paginate-v2";

interface IPackageResult extends Document {
  packageName: string;
  details: Schema.Types.Mixed;
  files?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PackageResultSchema: Schema<IPackageResult> = new Schema<IPackageResult>(
  {
    packageName: { type: String, required: true },
    details: { type: Schema.Types.Mixed },
    files: [String],
    notes: String,
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  }
);

interface IPatientPackage extends Document {
  clinicId: string;
  branchId?: string;
  patient: mongoose.Schema.Types.ObjectId;
  patientCode: string;
  package: mongoose.Schema.Types.ObjectId;
  doctor: mongoose.Schema.Types.ObjectId;

  result: IPackageResult;
  dateAssigned: Date;
  status: string;
  caseId?: string;
}

const PatientPackageSchema: Schema<IPatientPackage> = new Schema(
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
    package: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MasterPackage",
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    result: PackageResultSchema,
    dateAssigned: { type: Date, default: Date.now },
    status: { type: String, required: true, default: "Assigned" },
  },
  {
    timestamps: true,
  }
);

PatientPackageSchema.plugin(paginate);

interface PatientPackageDocument extends Document, IPatientPackage {}

const PatientPackage = mongoose.model<
  PatientPackageDocument,
  PaginateModel<PatientPackageDocument>
>("PatientPackages", PatientPackageSchema);

export default PatientPackage;
