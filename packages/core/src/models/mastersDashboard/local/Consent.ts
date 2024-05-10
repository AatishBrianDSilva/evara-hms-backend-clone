import mongoose, { Schema } from "mongoose";

interface consent {
  name: string;
  purpose: string;
  associatedWith: string;
  file: string;
}

const consentSchema = new Schema<consent>({
  name: { type: String, required: true },
  purpose: { type: String, required: true },
  associatedWith: { type: String, required: true },
  file: { type: String },
});

const Consent = mongoose.model<consent>("Consent", consentSchema);

export default Consent;
