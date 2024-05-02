import mongoose, { Schema } from "mongoose";

const branchSchema = new Schema(
  {
    clinicId: { type: Schema.Types.ObjectId, ref: "Clinic", required: true },
    code: { type: String, required: true, unique: true }, //Unique code for the branch
    branchName: { type: String, required: true },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zip: { type: String, required: true },
    },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    manager: { type: String },
  },
  { timestamps: true }
);

const Branch = mongoose.model("ClinicBranches", branchSchema);

export default Branch;
