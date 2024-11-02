import mongoose, { Schema } from 'mongoose';

interface appointmentReason {
  name: string;
  clinicId: string;
  branchId: string;
}

const appointmentReasonSchema = new Schema<appointmentReason>(
  {
    name: { type: String, required: true },
    clinicId: { type: String, required: true },
    branchId: { type: String, required: true },
  },
  {
    timestamps: true,
  },
);

const AppointmentReason = mongoose.model<appointmentReason>(
  'AppointmentReason',
  appointmentReasonSchema,
);

export default AppointmentReason;
