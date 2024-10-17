import { log } from "console";
import mongoose, { Document, PaginateModel, Schema } from "mongoose";
import paginate from "mongoose-paginate-v2";

export interface IDrugLocation extends Document {
  branchId: string;
  clinicId: string;
  location: string;
  main: boolean;
  notes: string;
  status?: "Active" | "Inactive";
}

const drugLocationSchema = new Schema<IDrugLocation>(
  {
    branchId: {
      type: String,
      index: true,
      required: true,
    },
    clinicId: {
      type: String,
      index: true,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    main: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    notes: { type: String, required: false },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
  },
  {
    timestamps: true,
  }
);

drugLocationSchema.index({ branchId: 1, location: 1 }, { unique: true });
drugLocationSchema.plugin(paginate);

drugLocationSchema.pre<IDrugLocation>("save", async function (next) {
  const existsAnyMain = await DrugLocation.findOne({
    branchId: this.branchId,
    main: true,
  });

  if (this.main) {
    if (existsAnyMain) {
      // Ensure this is the only main
      await DrugLocation.updateMany(
        { branchId: this.branchId, _id: { $ne: this._id } },
        { $set: { main: false } }
      );
    }
  } else if (!existsAnyMain || existsAnyMain._id.equals(this._id)) {
    // If there's no other main, force this one to stay as main
    this.main = true;
  }
  next();
});

drugLocationSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate();
  const docToUpdate = await this.model.findOne(this.getQuery());

  if (update?.main === false && docToUpdate.main) {
    // Check if it's the only main location
    const count = await DrugLocation.countDocuments({
      branchId: docToUpdate.branchId,
      main: true,
    });
    if (count === 1) {
      throw new Error("At least one main location must be set.");
    }
  } else if (update?.main) {
    // If setting this as main, unset others
    await DrugLocation.updateMany(
      { branchId: docToUpdate.branchId, _id: { $ne: docToUpdate._id } },
      { $set: { main: false } }
    );
  }
  next();
});

export interface IDrugLocationDocument extends IDrugLocation, Document {}

export const DrugLocation = mongoose.model<
  IDrugLocationDocument,
  PaginateModel<IDrugLocationDocument>
>("DrugLocation", drugLocationSchema);
