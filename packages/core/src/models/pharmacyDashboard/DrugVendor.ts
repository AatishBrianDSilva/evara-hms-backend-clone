import mongoose, { Document, PaginateModel, Schema } from "mongoose";
import { autoIncrementId } from "../Counters";
import paginate from "mongoose-paginate-v2";

export interface IDrugVendor extends Document {
  clinicId: string;
  branchId: string;
  name: string;
  code: string;
  gst: string;
  pan: string;
  tin: string;
  dl: string;
  contact: {
    person: string;
    phone: string;
    email: string;
  };
  address: {
    addressLine1: string;
    addressLine2: string;
    pincode: string;
    city: string;
    state: string;
    country: string;
  };
  remarks: string;
  status: "Active" | "Inactive";
}

const drugVendorSchema = new Schema<IDrugVendor>(
  {
    clinicId: {
      type: String,
      required: true,
      index: true,
    },
    branchId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      index: true,
      unique: true,
    },
    gst: {
      type: String,
      // required: true,
    },
    contact: {
      person: {
        type: String,
        // required: true,
      },
      phone: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        // required: true,
      },
    },
    pan: {
      type: String,
      // required: true,
    },
    tin: {
      type: String,
      // required: true,
    },
    dl: {
      type: String,
      // required: true,
    },
    address: {
      addressLine1: {
        type: String,
        // required: true,
      },
      addressLine2: {
        type: String,
      },
      pincode: {
        type: String,
        // required: true,
      },
      city: {
        type: String,
        // required: true,
      },
      state: {
        type: String,
        // required: true,
      },
      country: {
        type: String,
        // required: true,
      },
    },
    remarks: {
      type: String,
      required: false,
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

drugVendorSchema.pre("save", autoIncrementId("drugVendors", "code", "DV-"));

drugVendorSchema.plugin(paginate);

interface IDrugVendorDocument extends Document, IDrugVendor {}

export const DrugVendor = mongoose.model<
  IDrugVendorDocument,
  PaginateModel<IDrugVendorDocument>
>("DrugVendor", drugVendorSchema);
