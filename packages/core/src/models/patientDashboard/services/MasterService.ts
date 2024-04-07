import mongoose, { Document, Schema } from "mongoose";
import { EServiceTypes } from "./DefaultService";

interface IMasterService extends Document {
  serviceType: EServiceTypes;
  service: mongoose.Schema.Types.ObjectId;
  name: string;
  description?: string;
  cost: number;
  active: boolean;
}

const MasterServiceSchema: Schema = new Schema({
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
  name: { type: String, required: true },
  description: { type: String },
  cost: { type: Number, required: true },
  active: { type: Boolean, required: true, default: true },
});

const MasterService = mongoose.model<IMasterService>(
  "MasterService",
  MasterServiceSchema
);

export default MasterService;
