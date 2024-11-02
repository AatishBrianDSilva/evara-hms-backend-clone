import mongoose, { Schema } from 'mongoose';

interface appointmentSource {
  name: string;
  clinicId: string;
  branchId: string;
}

const appointmentSourceSchema = new Schema<appointmentSource>(
  {
    name: { type: String, required: true },
    clinicId: { type: String, required: true },
    branchId: { type: String, required: true },
  },
  {
    timestamps: true,
  },
);

const AppointmentSource = mongoose.model<appointmentSource>(
  'AppointmentSource',
  appointmentSourceSchema,
);

export default AppointmentSource;
