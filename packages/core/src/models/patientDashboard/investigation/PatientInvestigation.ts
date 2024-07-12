import mongoose, { Document, PaginateModel, Schema } from "mongoose";
import paginate from "mongoose-paginate-v2";

interface IInvestigationResult extends Document {
  testName: string;
  details: Schema.Types.Mixed;
  files?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InvestigationResultSchema: Schema = new Schema<IInvestigationResult>(
  {
    testName: { type: String, required: true },
    details: { type: Schema.Types.Mixed },
    files: [String],
    notes: String,
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  }
);

interface IPatientInvestigation extends Document {
  clinicId: string;
  branchId?: string;
  patient: mongoose.Schema.Types.ObjectId;
  doctor?: mongoose.Schema.Types.ObjectId;
  patientCode: string;
  investigation: mongoose.Schema.Types.ObjectId; // Reference to MasterInvestigation
  result: IInvestigationResult;
  dateAssigned: Date;
  status: string;
  caseId?: string;
}

const PatientInvestigationSchema: Schema = new Schema(
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
    investigation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MasterInvestigations",
      required: true,
    },
    result: InvestigationResultSchema,
    date: { type: Date, default: Date.now },
    status: { type: String, required: true, default: "Scheduled" },
  },
  {
    timestamps: true,
  }
);

PatientInvestigationSchema.plugin(paginate);

export interface PatientInvestigationDocument extends Document, IPatientInvestigation {}

const PatientInvestigation = mongoose.model<
  PatientInvestigationDocument,
  PaginateModel<PatientInvestigationDocument>
>("PatientInvestigations", PatientInvestigationSchema);

export default PatientInvestigation;

// Medical Test Result Schemas

//1. Blood Test Result
interface IBloodTestResultDetail extends Document {
  component: string;
  value: string;
  description?: string;
  unit?: string;
  referenceRange?: string;
}
export const BloodTestDetailsSchema = new Schema<IBloodTestResultDetail>({
  component: { type: String, required: true },
  value: { type: String, required: true },
  description: String,
  unit: String,
  referenceRange: String,
});

//2. Ultra Sound Scan Result
interface IUltraSoundScanDetails extends Document {
  scanType: string;
  lmpDate: Date;
  requestedDate: Date;
  dateOfScan: Date;
  dayOfCycle: number;
  transAbdominal: boolean;
  transVaginalSonography: boolean;
  utreusAppeared: string;
  utreusAppearedDesc?: string;
  uterusMeasurement: number;
  anteriorWall: string;
  posteriorWall: string;
  uterusVolume: number;
  uterocervicalLength: number;
  uterineLength: number;
  cervicalLength: number;
  myometrium: string;
  cavityEchoAppeared: string;
  endometrialThickness: number;
  anyOtherPathology?: string;
  rightOvary?: {
    notVisualzed?: boolean;
    volume?: number;
    ovaryMeasurement?: number;
    smallFollicles?: number;
    ovaryAFC?: number;
    dominantFollicleOrCyst?: string;
    accessibility?: string;
    adnexa?: string;
  };
  leftOvary?: {
    notVisualzed?: boolean;
    volume?: number;
    ovaryMeasurement?: number;
    smallFollicles?: number;
    ovaryAFC?: number;
    dominantFollicleOrCyst?: string;
    accessibility?: string;
    adnexa?: string;
  };
  impression: string;
  doctor: any;
  doctorRemarks: string;
  description: string;
}
export const UltraSoundScanDetailsSchema = new Schema<IUltraSoundScanDetails>({
  scanType: { type: String, required: true },
  lmpDate: { type: Date, required: true },
  requestedDate: { type: Date, required: true },
  dateOfScan: { type: Date, required: true },
  dayOfCycle: { type: Number, required: true },
  transAbdominal: { type: Boolean, required: true },
  transVaginalSonography: { type: Boolean, required: true },
  utreusAppeared: { type: String, required: true },
  utreusAppearedDesc: String,
  uterusMeasurement: { type: Number, required: true },
  anteriorWall: { type: String, required: true },
  posteriorWall: { type: String, required: true },
  uterusVolume: { type: Number, required: true },
  uterocervicalLength: { type: Number, required: true },
  uterineLength: { type: Number, required: true },
  cervicalLength: { type: Number, required: true },
  myometrium: { type: String, required: true },
  cavityEchoAppeared: { type: String, required: true },
  endometrialThickness: { type: Number, required: true },
  anyOtherPathology: String,
  rightOvary: {
    notVisualzed: { type: Boolean },
    volume: { type: Number },
    ovaryMeasurement: { type: Number },
    smallFollicles: { type: Number },
    ovaryAFC: { type: Number },
    dominantFollicleOrCyst: { type: String },
    accessibility: { type: String },
    adnexa: { type: String },
  },
  leftOvary: {
    notVisualzed: { type: Boolean },
    volume: { type: Number },
    ovaryMeasurement: { type: Number },
    smallFollicles: { type: Number },
    ovaryAFC: { type: Number },
    dominantFollicleOrCyst: { type: String },
    accessibility: { type: String },
    adnexa: { type: String },
  },
  impression: { type: String, required: true },
  doctor: { type: Schema.Types.Mixed, required: true },
  doctorRemarks: { type: String, required: true },
  description: { type: String, required: true },
});

//3. Base Line Follicular Monitoring

//4. Endometrial Assessment
interface IEndometrialAssessmentDetails extends Document {
  indication: string;
  lmpDate: Date;
  assessement: [
    {
      date: Date;
      day: number;
      ET: number;
      medications?: string;
      remarks?: string;
    }
  ];
  impression: string;
  doctorName: string;
  doctorRemarks: string;
}
export const EndometrialAssessmentDetailsSchema = new Schema<IEndometrialAssessmentDetails>({
  indication: { type: String, required: true },
  lmpDate: { type: Date, required: true },
  assessement: [
    {
      date: { type: Date, required: true },
      day: { type: Number, required: true },
      ET: { type: Number, required: true },
      medications: String,
      remarks: String,
    },
  ],
  impression: { type: String, required: true },
  doctorName: { type: String, required: true },
  doctorRemarks: { type: String, required: true },
});

//5. Early Pregnancy Scan
interface IEarlyPregnancyScanDetails extends Document {
  scanType: string;
  lmpDate: Date;
  embryoTransferDate: Date;
  requestedDate: Date;
  dateOfScan: Date;
  dateOfConception: Date;
  EDDByLMP: string;
  EDDByScan: string;
  LMPGestationalAge: string;
  modeOfConception: string;
  menstualCycle: string;
  bloodGroup: string;
  bmi: string;
  obstetricHistory: string;
  routeOfScan: string;
  machineModel: string;
  view: string;
  pregnancySite: string;
  gestationalSac: string;
  yolkSac: string;
  fetalPole: string;
  CRL: string;
  cardiacActivity: string;
  cervicalLength: string;
  rightOvary: string;
  leftOvary: string;
  earlyOutcome: string;
  impression: string;
  doctorName: string;
}
export const EarlyPregnancyScanDetailsSchema = new Schema<IEarlyPregnancyScanDetails>({
  scanType: { type: String, required: true },
  lmpDate: { type: Date, required: true },
  embryoTransferDate: { type: Date, required: true },
  requestedDate: { type: Date, required: true },
  dateOfScan: { type: Date, required: true },
  dateOfConception: { type: Date, required: true },
  EDDByLMP: { type: String, required: true },
  EDDByScan: { type: String, required: true },
  LMPGestationalAge: { type: String, required: true },
  modeOfConception: { type: String, required: true },
  menstualCycle: { type: String, required: true },
  bloodGroup: { type: String, required: true },
  bmi: { type: String, required: true },
  obstetricHistory: { type: String, required: true },
  routeOfScan: { type: String, required: true },
  machineModel: { type: String, required: true },
  view: { type: String, required: true },
  pregnancySite: { type: String, required: true },
  gestationalSac: { type: String, required: true },
  yolkSac: { type: String, required: true },
  fetalPole: { type: String, required: true },
  CRL: { type: String, required: true },
  cardiacActivity: { type: String, required: true },
  cervicalLength: { type: String, required: true },
  rightOvary: { type: String, required: true },
  leftOvary: { type: String, required: true },
  earlyOutcome: { type: String, required: true },
  impression: { type: String, required: true },
  doctorName: { type: String, required: true },
});
