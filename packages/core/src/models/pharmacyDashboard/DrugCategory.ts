import mongoose, { Document, PaginateModel, Schema } from 'mongoose';
import pagination from 'mongoose-paginate-v2';

export interface IDrugCategory extends Document {
  clinicId: string;
  name: string;
  notes: string;
  status?: 'Active' | 'Inactive';
}

const drugCategorySchema = new Schema<IDrugCategory>(
  {
    clinicId: {
      type: String,
      index: true,
    },
    name: {
      type: String,
      unique: true,
      required: true,
    },
    notes: { type: String, required: false },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
  },
  {
    timestamps: true,
  },
);

drugCategorySchema.plugin(pagination);

interface IDrugCategoryDocument extends Document, IDrugCategory {}

export const DrugCategory = mongoose.model<
  IDrugCategoryDocument,
  PaginateModel<IDrugCategoryDocument>
>('DrugCategory', drugCategorySchema);
