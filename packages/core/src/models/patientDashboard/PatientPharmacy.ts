import mongoose, { Document, PaginateModel, Schema } from "mongoose";
import pagination from "mongoose-paginate-v2";

interface IPatientPharmacy extends Document {
  patient: string;
  pharmacyStock: Schema.Types.ObjectId;
  locations: {
    location: Schema.Types.ObjectId;
    details: {
      quantity: number;
      batchNumber: string;
    }[];
  }[];
  doctor: Schema.Types.ObjectId;
  date: Date;
  status: string;
  allocatedBy: string;
  totalQuantity: number;
}

const detailsSchema = new Schema({
  quantity: { type: Number, required: true, min: 1 },
  batchNumber: { type: String, required: true },
});

const locationSchema = new Schema({
  location: {
    type: Schema.Types.ObjectId,
    ref: "DrugLocation",
    required: true,
  },
  details: [detailsSchema],
});

const patientPharmacySchema = new Schema(
  {
    patient: { type: String, required: true, index: true },
    pharmacyStock: {
      type: Schema.Types.ObjectId,
      ref: "PharmacyStock",
      required: true,
    },
    locations: [locationSchema],
    doctor: { type: Schema.Types.ObjectId, ref: "Doctor", required: true },
    date: { type: Date, required: true },
    status: { type: String, required: true },
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
  return this.locations.reduce((total, location) => {
    return (
      total +
      location.details.reduce((subTotal, detail) => {
        return subTotal + detail.quantity;
      }, 0)
    );
  }, 0);
});

patientPharmacySchema.plugin(pagination);

patientPharmacySchema.index({ pharmacyStock: 1 });
patientPharmacySchema.index({ "locations.location": 1 });
patientPharmacySchema.index({ doctor: 1 });
patientPharmacySchema.index({ patient: 1 });

export interface IPatientPharmacyModel extends Document, IPatientPharmacy {}

export const PatientPharmacy = mongoose.model<
  IPatientPharmacyModel,
  PaginateModel<IPatientPharmacyModel>
>("PatientPharmacy", patientPharmacySchema);
