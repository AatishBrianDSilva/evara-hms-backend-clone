import mongoose, { Schema } from "mongoose";

export enum EDrugCategory {
  Consumable = "Consumable",
  Medication = "Medication",
  Instrument = "Instrument",
  IVFConsumable = "IVF Consumable",
  GeneralConsumable = "General Consumable",
  IUIConsumable = "IUI Consumable",
  EmergencyMedication = "Emergency Medication",
}

export interface IDrugCategory {
  name: EDrugCategory;
  notes: string;
}

const drugCategorySchema = new Schema<IDrugCategory>(
  {
    name: {
      type: String,
      enum: Object.values(EDrugCategory),
      required: true,
    },
    notes: { type: String, required: false },
  },
  {
    timestamps: true,
  }
);

export const DrugCategory = mongoose.model<IDrugCategory>(
  "DrugCategory",
  drugCategorySchema
);
