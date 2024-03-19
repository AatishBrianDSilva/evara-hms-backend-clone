import mongoose, { Document, Schema } from "mongoose";
import { TestType } from "./MedicalTests";

interface IMasterInvestigation extends Document {
  testType: TestType;
  test: mongoose.Schema.Types.ObjectId;
  name: string;
  description?: string;
  cost: number;
  active: boolean;
}

const MasterInvestigationSchema: Schema = new Schema({
  testType: {
    type: String,
    required: true,
    enum: Object.values(TestType),
  },
  test: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "MedicalTests",
  },
  name: { type: String, required: true },
  description: { type: String },
  cost: { type: Number, required: true },
  active: { type: Boolean, required: true, default: true },
});

const MasterInvestigation = mongoose.model<IMasterInvestigation>(
  "MasterInvestigations",
  MasterInvestigationSchema
);

export default MasterInvestigation;
