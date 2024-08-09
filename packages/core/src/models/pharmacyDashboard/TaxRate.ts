import mongoose, { Schema, PaginateModel, Document } from "mongoose";
import paginate from "mongoose-paginate-v2";

export interface ITaxRate extends Document {
  clinicId: string;
  taxRate: number;
  notes: string;
}

const taxRateSchema = new Schema<ITaxRate>(
  {
    clinicId: { type: String, required: true, index: true },
    taxRate: { type: Number, required: true },
    notes: { type: String, required: false },
  },
  {
    timestamps: true,
  }
);

taxRateSchema.plugin(paginate);

interface ITaxRateDocument extends Document, ITaxRate {}

export const TaxRate = mongoose.model<
  ITaxRateDocument,
  PaginateModel<ITaxRateDocument>
>("TaxRate", taxRateSchema);
