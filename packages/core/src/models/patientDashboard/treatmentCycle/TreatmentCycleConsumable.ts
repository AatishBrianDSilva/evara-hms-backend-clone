import mongoose, { Document } from "mongoose";

interface ITreatmentCycleConsumable extends Document {
  clinicId: string;
  pharmacyStock: mongoose.Schema.Types.ObjectId;
  stage: mongoose.Schema.Types.ObjectId;
  // treatmentCycle: mongoose.Schema.Types.ObjectId;
  treatment: string;
}

const TreatmentCycleConsumableSchema =
  new mongoose.Schema<ITreatmentCycleConsumable>(
    {
      clinicId: { type: String, required: true, index: true },
      pharmacyStock: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PharmacyStock",
        required: true,
      },
      stage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TreatmentCycleStage",
        required: true,
      },
      treatment: {
        type: String,

        required: true,
      },
      // treatmentCycle: {
      //   type: mongoose.Schema.Types.ObjectId,
      //   ref: "TreatmentCycle",
      //   required: true,
      // },
    },
    {
      timestamps: true,
    }
  );

export const TreatmentCycleConsumable =
  mongoose.model<ITreatmentCycleConsumable>(
    "TreatmentCycleConsumable",
    TreatmentCycleConsumableSchema
  );
