import mongoose, { Schema } from "mongoose";

interface ILocationQuantity {
  location: Schema.Types.ObjectId;
  quantity: number;
}

const locationQuantitySchema = new Schema<ILocationQuantity>(
  {
    location: {
      type: Schema.Types.ObjectId,
      ref: "DrugLocation",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

export interface IPharmacyStock {
  branchId: string;
  item: Schema.Types.ObjectId;
  batchNo: string;
  vendor: Schema.Types.ObjectId;
  expiryDate: Date;
  pricePerPack: number;
  packSize: number;
  sellPrice: number;
  locations: ILocationQuantity[];
  totalQuantity: number;
}

const pharmacyStockSchema = new Schema({
  branchId: {
    type: String,
    required: true,
    index: true,
  },
  item: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "DrugItem",
  },
  batchNo: {
    type: String,
    required: true,
  },
  vendor: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "DrugVendor",
  },
  expiryDate: {
    type: Date,
    required: true,
  },
  pricePerPack: {
    type: Number,
    required: true,
  },
  packSize: {
    type: Number,
    required: true,
  },
  sellPrice: {
    type: Number,
    required: true,
  },
  totalQuantity: {
    type: Number,
    required: true,
  },
  locations: [locationQuantitySchema],
});

export const PharmacyStock = mongoose.model<IPharmacyStock>(
  "PharmacyStock",
  pharmacyStockSchema
);
