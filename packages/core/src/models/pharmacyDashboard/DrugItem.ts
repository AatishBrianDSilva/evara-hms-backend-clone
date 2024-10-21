import mongoose, { Document, PaginateModel, Schema } from "mongoose";
import { autoIncrementId } from "../Counters";
import paginate from "mongoose-paginate-v2";

export enum EDrugClass {
  ScheduleH1 = "Schedule H1",
  Gas = "Gas",
  ScheduleH = "Schedule H",
  ScheduleX = "Schedule X",
  General = "General",
  ScheduleH2 = "Schedule H2",
  ScheduleII = "Schedule II",
  Surgical = "Surgical",
  IVF = "IVF",
  ScheduleG = "Schedule G",
}

export interface IDrugItem extends Document {
  clinicId: string;
  name: string;
  genericName: string;
  drugClass: EDrugClass;
  code: string;
  hsnCode: string;
  category: Schema.Types.ObjectId;
  type?: Schema.Types.ObjectId;
  packSize: number;
  mrp: number; // MRP is the selling price
  rate: number; // Rate is the buying price
  taxRate: Schema.Types.ObjectId;
  manufacturer: Schema.Types.ObjectId;
  criticalCount?: number;
  status: "Active" | "Inactive";
}

const drugItemSchema = new Schema<IDrugItem>(
  {
    clinicId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      unique: true,
    },
    genericName: {
      type: String,
    },
    drugClass: {
      type: String,
      enum: Object.values(EDrugClass),
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
      // required: true,
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
      // required: true,
    },
    mrp: {
      type: Number,
      // required: true,
    },
    rate: {
      type: Number,
      // required: true,
    },
    manufacturer: {
      type: Schema.Types.ObjectId,
      ref: "DrugManufacturer",
      // required: true,
    },
    criticalCount: {
      type: Number,
      default: 10, // Default critical count if not specified
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
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

export const DrugItem = mongoose.model<IDrugItemDocument, PaginateModel<IDrugItemDocument>>(
  "DrugItem",
  drugItemSchema
);
