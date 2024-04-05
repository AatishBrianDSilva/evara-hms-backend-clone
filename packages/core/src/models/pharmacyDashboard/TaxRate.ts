import mongoose, { Schema } from "mongoose";

export interface ITaxRate {
  taxRate: number;
  notes: string;
}

const taxRateSchema = new Schema<ITaxRate>(
  {
    taxRate: { type: Number, required: true },
    notes: { type: String, required: false },
  },
  {
    timestamps: true,
  }
);

export const TaxRate = mongoose.model<ITaxRate>("TaxRate", taxRateSchema);
