import mongoose, { Document, PaginateModel, Types } from 'mongoose';
import paginate from 'mongoose-paginate-v2';

export enum DoctorSpeciality {
  General = 'General',
  ReproductiveEndocrinologist = 'Reproductive Endocrinologist',
  Andrologist = 'Andrologist',
  Embryologist = 'Embryologist',
  Urologist = 'Urologist',
  ReproductiveSurgeon = 'Reproductive Surgeon',
  Gynecologist = 'Gynecologist',
  FertilityCounselor = 'Fertility Counselor',
  GeneticCounselor = 'Genetic Counselor',
  // NursePractitionerRegisteredNurse = 'Nurse Practitioner/Registered Nurse',
  Sonographer = 'Sonographer',
  Anaesthetist = 'Anaesthetist',
}

interface DoctorData extends Document {
  clinicId: string;
  branchId: string;
  userId?: string;
  firstName: string;
  lastName: string;
  speciality: string;
  gender: string;
  dob: Date;
  education: string;
  mobile: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  state: string;
  city: string;
  pincode: string;
  licenceNumber: string;
  image: string;
  status: 'active' | 'inactive';
  global: boolean;
  deletedAt: Date;
}

export const doctorSchema = new mongoose.Schema(
  {
    clinicId: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    firstName: { type: String, required: true },
    lastName: { type: String },
    gender: { type: String, required: true },
    dob: { type: Date },
    education: { type: String },
    mobile: { type: String },
    speciality: { type: String, required: true },
    email: {
      type: String,

      match: [/.+\@.+\..+/, 'Invalid email format'],
    },
    addressLine1: { type: String },
    addressLine2: { type: String },
    state: { type: String },
    city: { type: String },
    pincode: { type: String },
    licenceNumber: { type: String },
    image: { type: String },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    global: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  },
);

doctorSchema.plugin(paginate);

interface DoctorDocument extends mongoose.Document, DoctorData {}

const Doctors = mongoose.model<DoctorDocument, PaginateModel<DoctorDocument>>(
  'doctors',
  doctorSchema,
);

export default Doctors;
