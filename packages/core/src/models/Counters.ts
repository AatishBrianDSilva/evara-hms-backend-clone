import { Schema, model } from "mongoose";

export interface CountersData {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<CountersData>({
  _id: String,
  seq: { type: Number, default: 0 },
});

const Counters = model<CountersData>("counters", counterSchema);

export const autoIncrementId = (
  modelName: string,
  idField: string,
  prefix: string = ""
) => {
  return async function (this: any, next: (error?: any) => void) {
    try {
      const doc = await Counters.findOneAndUpdate(
        { _id: modelName },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, session: this.$session() }
      );
      if (doc) {
        if (prefix) {
          this[idField] = `${prefix}${doc.seq}`;
        } else {
          this[idField] = doc.seq;
        }
        next();
      } else {
        throw new Error("Counter document not found");
      }
    } catch (error) {
      next(error); // Forward any errors to Mongoose's error handling
    }
  };
};

export const autoIncrementIdWithFieldPrefix = (
  modelName: string,
  idField: string,
  ...fields: string[]
) => {
  return async function (this: any, next: (error?: any) => void) {
    try {
      const doc = await Counters.findOneAndUpdate(
        { _id: modelName },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, session: this.$session() }
      );
      if (doc) {
        if (fields.length > 0) {
          let prefix = "";
          fields.forEach((field) => {
            prefix += this[field];
          });
          const id = `${prefix}-${doc.seq}`;
          this[idField] = id;
        } else {
          this[idField] = doc.seq;
        }
        next();
      } else {
        throw new Error("Counter document not found");
      }
    } catch (error) {
      next(error); // Forward any errors to Mongoose's error handling
    }
  };
};
