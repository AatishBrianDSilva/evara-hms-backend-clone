import mongoose, { Document, PaginateModel, Schema } from "mongoose";
import pagination from "mongoose-paginate-v2";

interface IPatientPharmacy extends Document {
  patient: string;
  item: {
    stock: Schema.Types.ObjectId;
    details: {
      location: Schema.Types.ObjectId;
      quantity: number;
      batchNumber: string;
    }[];
  };
  doctor: Schema.Types.ObjectId;
  date: Date;
  allocatedBy: string;
  totalQuantity: number;
}

const detailsSchema = new Schema({
  location: {
    type: Schema.Types.ObjectId,
    ref: "DrugLocation",
    required: true,
  },
  quantity: { type: Number, required: true, min: 1 },
  batchNumber: { type: String, required: true },
});

const itemSchema = new Schema({
  stock: {
    type: Schema.Types.ObjectId,
    ref: "PharmacyStock",
    required: true,
  },

  details: [detailsSchema],
});

const patientPharmacySchema = new Schema(
  {
    patient: { type: String, required: true, index: true },
    item: itemSchema,
    doctor: { type: Schema.Types.ObjectId, ref: "Doctor", required: true },
    date: { type: Date, required: true },
    allocatedBy: { type: String, required: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

patientPharmacySchema.virtual("totalQuantity").get(function () {
  // This function calculates the sum of all quantities in each location detail
  return this.item?.details.reduce((acc, curr) => acc + curr.quantity, 0);
});

patientPharmacySchema.plugin(pagination);

patientPharmacySchema.index({ "item.stock": 1 });
patientPharmacySchema.index({ "item.location": 1 });
patientPharmacySchema.index({ doctor: 1 });
patientPharmacySchema.index({ patient: 1 });

export interface IPatientPharmacyModel extends Document, IPatientPharmacy {}

export const PatientPharmacy = mongoose.model<
  IPatientPharmacyModel,
  PaginateModel<IPatientPharmacyModel>
>("PatientPharmacy", patientPharmacySchema);
