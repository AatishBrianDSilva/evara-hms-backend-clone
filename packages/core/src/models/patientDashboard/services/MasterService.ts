import mongoose, { Document, Schema } from "mongoose";
import { EServiceTypes } from "./DefaultService";
import { EGender } from "../investigation/MedicalTests";

interface IMasterService extends Document {
  clinicId: string;
  serviceType: EServiceTypes;
  service: mongoose.Schema.Types.ObjectId;
  name: string;
  description?: string;
  cost: number;
  total: number;
  active: boolean;
  validTill: Date;
  gender: EGender;
  isPackageItem: Boolean;
}

const MasterServiceSchema: Schema = new Schema({
  clinicId: { type: String, required: true, index: true },
  serviceType: {
    type: String,
    required: true,
    enum: Object.values(EServiceTypes),
  },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "DefaultService",
  },
  name: { type: String, required: true, unique: true },
  description: { type: String },
  gender: { type: String, required: true, enum: Object.values(EGender) },
  cost: { type: Number, required: true },
  total: { type: Number, required: true },
  active: { type: Boolean, required: true, default: true },
  validTill: { type: Date },
  isPackageItem: { type: Boolean, default: false }, // Set default to false
});

const MasterService = mongoose.model<IMasterService>("MasterService", MasterServiceSchema);

export default MasterService;
