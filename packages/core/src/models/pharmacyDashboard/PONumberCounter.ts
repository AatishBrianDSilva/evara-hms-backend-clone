import mongoose, { Schema, Document } from "mongoose";

export interface IPoNumberCounter extends Document {
  branchId: string;
  monthYear: string; // Format: "09-2024"
  sequence: number;
}

const poNumberCounterSchema = new Schema({
  branchId: { type: String, required: true },
  monthYear: { type: String, required: true }, // e.g., "09-2024"
  sequence: { type: Number, required: true, default: 1 },
});

export const PoNumberCounter = mongoose.model<IPoNumberCounter>(
  "PoNumberCounter",
  poNumberCounterSchema
);
