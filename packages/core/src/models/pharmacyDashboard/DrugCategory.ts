import mongoose, { Document, PaginateModel, Schema } from "mongoose";
import pagination from "mongoose-paginate-v2";

export interface IDrugCategory extends Document {
  name: string;
  notes: string;
}

const drugCategorySchema = new Schema<IDrugCategory>(
  {
    name: {
      type: String,
      unique: true,
      required: true,
    },
    notes: { type: String, required: false },
  },
  {
    timestamps: true,
  }
);

drugCategorySchema.plugin(pagination);

interface IDrugCategoryDocument extends Document, IDrugCategory {}

export const DrugCategory = mongoose.model<
  IDrugCategoryDocument,
  PaginateModel<IDrugCategoryDocument>
>("DrugCategory", drugCategorySchema);
