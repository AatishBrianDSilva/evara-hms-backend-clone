import mongoose, { Document, PaginateModel, Schema } from "mongoose";
import { autoIncrementId } from "../Counters";
import paginate from "mongoose-paginate-v2";

export interface IDrugItem extends Document {
  name: string;
  code: string;
  hsnCode: string;
  category: Schema.Types.ObjectId;
  type?: Schema.Types.ObjectId;
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
      unique: true,
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
    type: {
      type: Schema.Types.ObjectId,
      ref: "DrugType",
    },
    packSize: {
      type: Number,
      // required: true,
    },
    taxRate: {
      type: Schema.Types.ObjectId,
      ref: "TaxRate",
      required: true,
    },
    manufacturer: {
      type: Schema.Types.ObjectId,
      ref: "DrugManufacturer",
      // required: true,
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

drugItemSchema.index({ name: 1 });

drugItemSchema.pre("save", autoIncrementId("drugItems", "code", "DI-"));

drugItemSchema.plugin(paginate);

interface IDrugItemDocument extends Document, IDrugItem {}

export const DrugItem = mongoose.model<
  IDrugItemDocument,
  PaginateModel<IDrugItemDocument>
>("DrugItem", drugItemSchema);
