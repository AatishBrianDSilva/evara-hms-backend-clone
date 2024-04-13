import mongoose, { Document, PaginateModel, Schema } from "mongoose";
import pagination from "mongoose-paginate-v2";

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

interface IBatchDetails {
  batchNo: string;
  expiryDate: Date;
  vendor: Schema.Types.ObjectId;
  pricePerPack: number;
  packSize: number;
  sellPrice: number;
  locations: ILocationQuantity[];
}

const batchDetailsSchema = new Schema<IBatchDetails>(
  {
    batchNo: {
      type: String,
      required: true,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    vendor: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
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
    locations: [locationQuantitySchema],
  },
  {
    timestamps: true,
  }
);

export interface IPharmacyStock extends Document {
  branchId: string;
  item: Schema.Types.ObjectId;
  batches: IBatchDetails[];
}

const pharmacyStockSchema = new Schema<IPharmacyStock>(
  {
    branchId: {
      type: String,
      required: true,
    },
    item: {
      type: Schema.Types.ObjectId,
      ref: "DrugItem",
      required: true,
    },
    batches: [batchDetailsSchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for calculating total quantity
pharmacyStockSchema.virtual("totalQuantity").get(function () {
  return this.batches.reduce((total, batch) => {
    return (
      total +
      batch.locations.reduce((sum, location) => {
        return sum + location.quantity;
      }, 0)
    );
  }, 0);
});

pharmacyStockSchema.plugin(pagination);

interface IPharmacyStockDocument extends Document, IPharmacyStock {}

export const PharmacyStock = mongoose.model<
  IPharmacyStockDocument,
  PaginateModel<IPharmacyStockDocument>
>("PharmacyStock", pharmacyStockSchema);
