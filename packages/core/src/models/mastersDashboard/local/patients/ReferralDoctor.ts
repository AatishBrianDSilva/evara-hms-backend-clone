import mongoose, { Schema } from "mongoose";

interface IReferralDoctor {
  name: string;
  phone: string;
  city: string;
  speaciality: string;
}

const referralDoctorSchema = new Schema<IReferralDoctor>({
  name: { type: String, required: true },
  phone: { type: String },
  city: { type: String },
  speaciality: { type: String },
});

const ReferralDoctor = mongoose.model<IReferralDoctor>(
  "ReferralDoctor",
  referralDoctorSchema
);

export default ReferralDoctor;
