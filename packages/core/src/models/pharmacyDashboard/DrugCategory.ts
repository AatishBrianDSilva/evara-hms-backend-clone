import mongoose, { Schema } from "mongoose";

export interface IDrugCategory {
  name: string;
  notes: string;
}

const drugCategorySchema = new Schema<IDrugCategory>(
  {
    name: {
      type: String,
      lowercase: true,
      unique: true,
      required: true,
    },
    notes: { type: String, required: false },
  },
  {
    timestamps: true,
  }
);

export const DrugCategory = mongoose.model<IDrugCategory>(
  "DrugCategory",
  drugCategorySchema
);
