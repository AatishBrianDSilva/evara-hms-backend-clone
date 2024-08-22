import mongoose, { Document, Schema } from "mongoose";

interface IPackageItem {
  itemId: mongoose.Schema.Types.ObjectId;
  name: string;
  validTill: Date;
  // isPackageItem: boolean;
}

// Interface for the MasterPackage document
interface IMasterPackage extends Document {
  clinicId: string;
  name: string;
  cost: number;
  total: number;
  validTill: Date;
  active: boolean;
  gender: "male" | "female";
  procedures: IPackageItem[];
  investigations: IPackageItem[];
  treatmentCycles: IPackageItem[];
  cryoPreservations: IPackageItem[];
  services: IPackageItem[];
}

// Schema for individual package items
const PackageItemSchema: Schema = new Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: "itemModel" },
  name: { type: String, required: true },
  validTill: { type: Date, required: true },
  // isPackageItem: { type: Boolean, required: true }, // Commented out but can be reintroduced if needed
});

// Schema for the MasterPackage
const MasterPackageSchema: Schema = new Schema(
  {
    clinicId: { type: String, required: true, index: true },
    name: { type: String, required: true, unique: true },
    cost: { type: Number, required: true },
    total: { type: Number, required: true, default: 0 },
    validTill: { type: Date, required: true },
    active: { type: Boolean, required: true, default: true },
    gender: { type: String, required: true, enum: ["male", "female"] },
    procedures: [PackageItemSchema],
    investigations: [PackageItemSchema],
    treatmentCycles: [PackageItemSchema],
    cryoPreservations: [PackageItemSchema],
    services: [PackageItemSchema],
  },
  {
    timestamps: true,
  }
);

// Model for MasterPackage
const MasterPackage = mongoose.model<IMasterPackage>("MasterPackage", MasterPackageSchema);

export default MasterPackage;
