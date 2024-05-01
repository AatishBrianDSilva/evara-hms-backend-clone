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
      index: true,
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

export interface IBatchDetails {
  batchNo: string;
  expiryDate: Date;
  vendor: Schema.Types.ObjectId;
  packSize: number;
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
    packSize: {
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
  sellPrice: number;
  batches: IBatchDetails[];
  quantityOnHold: number;
  totalQuantity: number;
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
    sellPrice: {
      type: Number,
      required: true,
      default: 0,
    },
    batches: [batchDetailsSchema],
    quantityOnHold: {
      type: Number,
      required: false,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

pharmacyStockSchema.index({ branchId: 1, item: 1 });
pharmacyStockSchema.index({ "batches.batchNo": 1 });
pharmacyStockSchema.index({ "batches.expiryDate": 1 });
pharmacyStockSchema.index({ "batches.vendor": 1 });

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
