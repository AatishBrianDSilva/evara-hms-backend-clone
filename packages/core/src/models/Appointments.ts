import mongoose, { Document, PaginateModel, Schema, Types } from "mongoose";
import paginate from "mongoose-paginate-v2";

interface AppointmentData extends Document {
  clinicId: string;
  branchId: string;
  doctorId: Schema.Types.ObjectId;
  patientId?: string;
  date: Date;
  time: string;
  fullName?: string;
  phone?: string;
  city?: string;
  reason: string;
  mode: string;
  source: string;
  reportedTime?: Date;
  notes: string;
  status: "Scheduled" | "Reported" | "Cancelled" | "Completed";
}

export const appointmentSchema = new mongoose.Schema(
  {
    clinicId: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: "doctors",
      required: true,
      index: true,
    },
    date: { type: Date, required: true, index: true },
    time: {
      type: String,
      required: true,
      validate: {
        validator: function (v: string) {
          return /^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/.test(v);
        },
        message: (props: { value: string }) =>
          `${props.value} is not a valid time format (HH:MM AM/PM)!`,
      },
    },
    patientId: { type: String, index: true },
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    city: { type: String, required: true },
    reason: { type: String, required: true },
    mode: { type: String, required: true },
    source: { type: String, required: true },
    reportedTime: { type: Date },
    notes: { type: String },
    status: {
      type: String,
      enum: ["Scheduled", "Reported", "Cancelled", "Completed"],
      default: "Scheduled",
    },
  },
  {
    timestamps: true,
  }
);

appointmentSchema.index({ date: 1, time: 1, doctorId: 1 }, { unique: true });

appointmentSchema.plugin(paginate);

interface AppointmentDocument extends mongoose.Document, AppointmentData {}

const Appointments = mongoose.model<
  AppointmentDocument,
  PaginateModel<AppointmentDocument>
>("appointments", appointmentSchema);

export default Appointments;
