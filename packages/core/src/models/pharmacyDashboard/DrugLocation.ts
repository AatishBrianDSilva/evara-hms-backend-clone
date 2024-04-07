import mongoose, { Document, PaginateModel, Schema } from "mongoose";
import paginate from "mongoose-paginate-v2";

export interface IDrugLocation extends Document {
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
      required: true,
    },
    notes: { type: String, required: false },
  },
  {
    timestamps: true,
  }
);

drugLocationSchema.index({ branchId: 1, location: 1 }, { unique: true });

drugLocationSchema.plugin(paginate);

interface IDrugLocationDocument extends Document, IDrugLocation {}

export const DrugLocation = mongoose.model<
  IDrugLocationDocument,
  PaginateModel<IDrugLocationDocument>
>("DrugLocation", drugLocationSchema);
