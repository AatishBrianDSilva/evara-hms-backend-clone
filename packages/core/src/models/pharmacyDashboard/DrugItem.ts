import mongoose, { Schema } from "mongoose";
import { autoIncrementId, autoIncrementIdWithFieldPrefix } from "../Counters";

export interface IDrugItem {
  name: string;
  code: string;
  hsnCode: string;
  category: Schema.Types.ObjectId;
  packSize: number;
  taxRate: Schema.Types.ObjectId;
  manufacturer: Schema.Types.ObjectId;
  status: "Active" | "Inactive";
}

const drugItemSchema = new Schema<IDrugItem>(
  {
    name: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      index: true,
      unique: true,
    },
    hsnCode: {
      type: String,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "DrugCategory",
      required: true,
    },
    packSize: {
      type: Number,
      required: true,
    },
    taxRate: {
      type: Schema.Types.ObjectId,
      ref: "TaxRate",
      required: true,
    },
    manufacturer: {
      type: Schema.Types.ObjectId,
      ref: "DrugManufacturer",
      required: true,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Inactive",
    },
  },
  {
    timestamps: true,
  }
);

drugItemSchema.pre("save", autoIncrementId("drugItems", "code", "DI-"));

export const DrugItem = mongoose.model<IDrugItem>("DrugItem", drugItemSchema);
