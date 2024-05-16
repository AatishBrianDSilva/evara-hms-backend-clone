import mongoose, { Document, PaginateModel, Types } from "mongoose";
import paginate from "mongoose-paginate-v2";
import { autoIncrementId } from "../../Counters";

interface DonorData extends Document {
  clinicId: string;
  branchId: string;
  donorId: string;
  title: string;
  firstName: string;
  lastName: string;
  gender: string;
  dob: Date;
  education?: string;
  maritalStatus?: string;
  bloodGroup: string;
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
  status: "active" | "inactive";
  caseId?: string;
}

export const patientSchema = new mongoose.Schema(
  {
    clinicId: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    caseId: { type: String },
    donorId: { type: String, index: true },
    title: { type: String },
    firstName: { type: String, required: true },
    lastName: { type: String },
    gender: { type: String, required: true },
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
    image: { type: String },
    remarks: { type: String },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  {
    timestamps: true,
    strict: false,
  }
);

patientSchema.index({ clinicId: 1, branchId: 1, donorId: 1 }, { unique: true });

patientSchema.pre("save", autoIncrementId("donors", "donorId", "DN-"));

patientSchema.plugin(paginate);

interface DonorDocument extends mongoose.Document, DonorData {}

const Donor = mongoose.model<DonorDocument, PaginateModel<DonorDocument>>(
  "donors",
  patientSchema
);

export default Donor;
