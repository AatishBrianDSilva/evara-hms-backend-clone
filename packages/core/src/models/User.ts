import mongoose, { CallbackError } from "mongoose";
import bcrypt from "bcryptjs";

export enum EUserRole {
  Admin = "admin",
  Reception = "reception",
  Nurse = "nurse",
  Doctor = "doctor",
  Pharmacist = "pharmacist",
  PharmacyManager = "pharmacy-manager",
  Billing = "billing",
}

export interface IUser {
  _id: string;
  clinicId: string;
  branchId: string;
  username: string;
  email: string;
  password: string;
  phone: string;
  role: EUserRole;
  isActive: boolean;
  deletedAt?: Date;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    clinicId: { type: String, required: true },
    branchId: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String },
    role: {
      type: String,
      required: true,
      enum: Object.values(EUserRole),
    },
    isActive: { type: Boolean, required: true, default: true },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    this.password = await bcrypt.hash(this.password, 8);
    next();
  } catch (error) {
    const err = error as CallbackError;
    next(err);
  }
});

userSchema.index({ clinicId: 1, branchId: 1 });

export const User = mongoose.model<IUser>("User", userSchema);
