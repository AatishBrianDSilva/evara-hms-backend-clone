import mongoose, { Document, PaginateModel, Schema } from "mongoose";
import pagination from "mongoose-paginate-v2";

export interface IDrugType extends Document {
  name: string;
  shortcode: string;
  notes?: string;
}

const drugTypeSchema = new Schema<IDrugType>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    shortcode: {
      type: String,
      required: true,
      validate: {
        validator: function (v: string) {
          return /^[A-Z]{3}$/.test(v); // Ensures the shortcode is exactly three uppercase letters long
        },
        message: (props) =>
          `${props.value} is not a valid three-letter shortcode!`,
      },
    },
    notes: { type: String, required: false },
  },
  {
    timestamps: true,
  }
);

drugTypeSchema.plugin(pagination);

interface IDrugTypeDocument extends Document, IDrugType {}

export const DrugType = mongoose.model<
  IDrugTypeDocument,
  PaginateModel<IDrugTypeDocument>
>("DrugType", drugTypeSchema);
