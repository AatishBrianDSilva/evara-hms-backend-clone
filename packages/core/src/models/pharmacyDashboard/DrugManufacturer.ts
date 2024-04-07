import mongoose, { Document, PaginateModel, Schema } from "mongoose";
import pagination from "mongoose-paginate-v2";

export interface IDrugManufacturer extends Document {
  name: string;
  category: [Schema.Types.ObjectId];
  taxRate: Schema.Types.ObjectId;
  cst: string;
  apgst: string;
  pan: string;
  tin: string;
  contact: {
    person: string;
    phone: string;
    email: string;
    website?: string;
  };
  address: {
    addressLine1: string;
    addressLine2?: string;
    pincode: string;
    city: string;
    state: string;
    country: string;
  };
  status: "Active" | "Inactive";
}

const drugManufacturerSchema = new Schema<IDrugManufacturer>(
  {
    name: {
      type: String,
      required: true,
    },
    category: [
      {
        type: Schema.Types.ObjectId,
        ref: "DrugCategory",
      },
    ],
    taxRate: {
      type: Schema.Types.ObjectId,
      ref: "TaxRate",
    },
    cst: {
      type: String,
      required: true,
    },
    apgst: {
      type: String,
      required: true,
    },
    contact: {
      person: {
        type: String,
        required: true,
      },
      phone: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        required: true,
      },
      website: {
        type: String,
      },
    },
    address: {
      addressLine1: {
        type: String,
        required: true,
      },
      addressLine2: {
        type: String,
      },
      pincode: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      state: {
        type: String,
        required: true,
      },
      country: {
        type: String,
        required: true,
      },
    },
    pan: {
      type: String,
      required: true,
    },
    tin: {
      type: String,
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

drugManufacturerSchema.plugin(pagination);

interface IDrugManufacturerDocument extends Document, IDrugManufacturer {}

export const DrugManufacturer = mongoose.model<
  IDrugManufacturerDocument,
  PaginateModel<IDrugManufacturerDocument>
>("DrugManufacturer", drugManufacturerSchema);
