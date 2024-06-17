import mongoose, { Document, PaginateModel, Schema } from "mongoose";
import { autoIncrementId } from "../Counters";
import paginate from "mongoose-paginate-v2";

export interface IPharmacyInvoice extends Document {
  purchaseOrderId: Schema.Types.ObjectId;
  invoice: string;
  bucket: string;
  key: string;
}

const pharmacyInvoiceSchema = new Schema(
  {
    purchaseOrderId: { type: String, required: true },
    invoice: { type: String, required: true },
    bucket: { type: String, required: true },
    key: { type: String, required: true },
  },
  { timestamps: true }
);

pharmacyInvoiceSchema.plugin(paginate);

export interface IPharmacyInvoiceDocument extends Document, IPharmacyInvoice {}

export const PharmacyInvoice = mongoose.model<
  IPharmacyInvoiceDocument,
  PaginateModel<IPharmacyInvoiceDocument>
>("PharmacyInvoice", pharmacyInvoiceSchema);
