import mongoose, { Schema } from "mongoose";

export enum EDrugLocation {
  OPDPharmacy = "OPD Pharmacy",
  OTPharmacy = "OT Pharmacy",
  IVFPharmacy = "IVF Pharmacy",
  CentralPharmacy = "Central Pharmacy",
  EmergencyPharmacy = "Emergency Pharmacy",
  InternalStock = "Internal Stock",
  RecoveryPharmacy = "Recovery Pharmacy",
}

export interface IDrugLocation {
  branchId: string;
  location: EDrugLocation;
  notes: string;
}

const drugLocationSchema = new Schema<IDrugLocation>(
  {
    branchId: {
      type: String,
      index: true,
      required: true,
    },
    location: {
      type: String,
      enum: Object.values(EDrugLocation),
      required: true,
    },
    notes: { type: String, required: false },
  },
  {
    timestamps: true,
  }
);

drugLocationSchema.index({ branchId: 1, location: 1 }, { unique: true });

export const DrugLocation = mongoose.model<IDrugLocation>(
  "DrugLocation",
  drugLocationSchema
);
