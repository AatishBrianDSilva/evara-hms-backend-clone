import mongoose, { Schema } from "mongoose";

const clinicSchema = new Schema(
  {
    code: { type: String, required: true, unique: true }, //Unique code for the clinic
    name: { type: String, required: true },
    headOfficeAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
    },
    phone: { type: String, required: true },
    email: {
      type: String,
      required: true,
      match: [/.+\@.+\..+/, "Invalid email format"],
    },
  },
  { timestamps: true }
);

const Clinic = mongoose.model("Clinic", clinicSchema);

export default Clinic;
