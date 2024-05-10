import mongoose, { Schema } from "mongoose";

interface appointmentSource {
  name: string;
}

const appointmentSourceSchema = new Schema<appointmentSource>({
  name: { type: String, required: true },
});

const AppointmentSource = mongoose.model<appointmentSource>(
  "AppointmentSource",
  appointmentSourceSchema
);

export default AppointmentSource;
