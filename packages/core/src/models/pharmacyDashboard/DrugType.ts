import mongoose, { Schema } from "mongoose";

export interface IDrugType {
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
      lowercase: true,
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

export const DrugType = mongoose.model<IDrugType>("DrugType", drugTypeSchema);
