import mongoose, { Schema } from "mongoose";

const branchSchema = new Schema(
  {
    clinicId: { type: String, required: true },
    code: { type: String, required: true, unique: true }, //Unique code for the branch
    branchName: { type: String, required: true },
    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      zip: { type: String },
    },
    phone: { type: String },
    email: { type: String },
    manager: { type: String },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

const Branch = mongoose.model("ClinicBranches", branchSchema);

export default Branch;
