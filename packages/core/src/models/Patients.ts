import mongoose, { PaginateModel } from "mongoose";
import paginate from "mongoose-paginate-v2";

interface PatientData {
  clinicId?: string;
  branchId?: string;
  patientId?: string;
  title?: string;
  firstName: string;
  lastName: string;
  gender?: string;
  age: number;
  dob?: Date;
  education?: string;
  maritalStatus?: string;
  bloodGroup?: string;
  countryBirth?: string;
  nationality?: string;
  motherTounge?: string;
  occupation?: string;
  religion?: string;
  mobile: string;
  alernativeMobile?: string;
  email: string;
  dependentType?: string;
  dependentName?: string;
  dependentRelation?: string;
  dependentMobile?: string;
  dependentEmail?: string;
  addressLine1: string;
  addressLine2?: string;
  state: string;
  city: string;
  pincode?: string;
  idProofType?: string;
  idProofNumber?: string;
  idProofIssuedCountry?: string;
  ABHANumber?: string;
  reasonOfVisit?: string;
  referredBy?: string;
  referredByOther?: string;
  referredByDoctor?: string;
  marketingSource?: string;
  intepreter?: boolean;
  intepreteName?: string;
  isPatientSurrogate?: boolean;
  isPatientDeceased?: boolean;
  detailsOfDeath?: string;
  isPatientInsured?: boolean;
  insuranceCompany?: string;
  insuranceSponsorName?: string;
  insurancePolicyNumber?: string;
  insurancePolicyHolderName?: string;
  insuranceAmountEligible?: string;
  image?: mongoose.Schema.Types.Mixed;
  remarks?: string;
}

export const patientSchema = new mongoose.Schema(
  {
    title: { type: String },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    gender: { type: String },
    age: { type: Number, required: true, min: 0 },
    dob: { type: Date },
    education: { type: String },
    maritalStatus: { type: String },
    bloodGroup: { type: String },
    countryBirth: { type: String },
    nationality: { type: String },
    motherTounge: { type: String },
    occupation: { type: String },
    religion: { type: String },
    mobile: { type: String, required: true },
    alernativeMobile: { type: String },
    email: {
      type: String,
      required: true,
      match: [/.+\@.+\..+/, "Invalid email format"],
    },
    dependentType: { type: String },
    dependentName: { type: String },
    dependentRelation: { type: String },
    dependentMobile: { type: String },
    dependentEmail: {
      type: String,
      match: [/.+\@.+\..+/, "Invalid email format"],
    },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    state: { type: String, required: true },
    city: { type: String, required: true },
    pincode: { type: String },
    idProofType: { type: String },
    idProofNumber: { type: String },
    idProofIssuedCountry: { type: String },
    ABHANumber: { type: String },
    reasonOfVisit: { type: String },
    referredBy: { type: String },
    referredByOther: { type: String },
    referredByDoctor: { type: String },
    marketingSource: { type: String },
    intepreter: { type: Boolean },
    intepreteName: { type: String },
    isPatientSurrogate: { type: Boolean },
    isPatientDeceased: { type: Boolean },
    detailsOfDeath: { type: String },
    isPatientInsured: { type: Boolean },
    insuranceCompany: { type: String },
    insuranceSponsorName: { type: String },
    insurancePolicyNumber: { type: String },
    insurancePolicyHolderName: { type: String },
    insuranceAmountEligible: { type: String },
    image: { type: mongoose.Schema.Types.Mixed },
    remarks: { type: String },
  },
  {
    timestamps: true,
  }
);

patientSchema.plugin(paginate);

interface PatientDocument extends mongoose.Document, PatientData {}

const Patient = mongoose.model<PatientDocument, PaginateModel<PatientDocument>>(
  "Patient",
  patientSchema,
  "patients"
);

export default Patient;
