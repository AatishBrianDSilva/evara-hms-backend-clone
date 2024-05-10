import mongoose, { Schema } from "mongoose";

interface appointmentReason {
  name: string;
}

const appointmentReasonSchema = new Schema<appointmentReason>({
  name: { type: String, required: true },
});

const AppointmentReason = mongoose.model<appointmentReason>(
  "AppointmentReason",
  appointmentReasonSchema
);

export default AppointmentReason;
