import mongoose, { Schema } from "mongoose";

interface IReferralDoctor {
  clinicId: string;
  branchId: string;
  name: string;
  phone: string;
  city: string;
  speaciality: string;
}

const referralDoctorSchema = new Schema<IReferralDoctor>(
  {
    clinicId: { type: String, required: true },
    branchId: { type: String, required: true },
    name: { type: String, required: true },
    phone: { type: String },
    city: { type: String },
    speaciality: { type: String },
  },
  { timestamps: true }
);

const ReferralDoctor = mongoose.model<IReferralDoctor>(
  "ReferralDoctor",
  referralDoctorSchema
);

export default ReferralDoctor;
