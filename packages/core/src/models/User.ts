import mongoose, { CallbackError } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser {
  _id: string;
  clinicId: string;
  branchId: string;
  username: string;
  email: string;
  password: string;
  role: string;
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
    role: {
      type: String,
      required: true,
      enum: ["doctor", "nurse", "admin", "receptionist"],
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
