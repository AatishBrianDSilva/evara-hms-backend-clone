import mongoose, { Schema } from "mongoose";

export interface IDrugLocation {
  branchId: string;
  location: string;
  notes: string;
}

const drugLocationSchema = new Schema<IDrugLocation>(
  {
    branchId: {
      type: String,
      index: true,
      required: true,
    },
    location: {
      type: String,
      lowercase: true,
      required: true,
    },
    notes: { type: String, required: false },
  },
  {
    timestamps: true,
  }
);

drugLocationSchema.index({ branchId: 1, location: 1 }, { unique: true });

export const DrugLocation = mongoose.model<IDrugLocation>(
  "DrugLocation",
  drugLocationSchema
);
