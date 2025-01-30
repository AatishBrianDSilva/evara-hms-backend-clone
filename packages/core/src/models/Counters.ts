import { Schema, model } from 'mongoose';

export interface CountersData {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<CountersData>({
  _id: String,
  seq: { type: Number, default: 0 },
});

const Counters = model<CountersData>('counters', counterSchema);

export const autoIncrementId = (
  modelName: string,
  idField: string,
  prefix: string = '',
) => {
  return async function (this: any, next: (error?: any) => void) {
    if (!this.isNew && this[idField]) {
      return next(); // Skip this hook if the document is not new or the ID is already set
    }

    try {
      const doc = await Counters.findOneAndUpdate(
        { _id: modelName },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, session: this.$session() },
      );
      if (doc) {
        if (prefix) {
          this[idField] = `${prefix}${doc.seq}`;
        } else {
          this[idField] = doc.seq;
        }
        next();
      } else {
        throw new Error('Counter document not found');
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
    if (!this.isNew && this[idField]) {
      return next(); // Skip this hook if the document is not new or the ID is already set
    }

    try {
      const doc = await Counters.findOneAndUpdate(
        { _id: modelName },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, session: this.$session() },
      );
      if (doc) {
        if (fields.length > 0) {
          let prefix = '';
          fields.forEach(field => {
            prefix += this[field];
          });
          const id = `${prefix}-${doc.seq}`;
          this[idField] = id;
        } else {
          this[idField] = doc.seq;
        }
        next();
      } else {
        throw new Error('Counter document not found');
      }
    } catch (error) {
      next(error); // Forward any errors to Mongoose's error handling
    }
  };
};

export const autoIncrementPatientIdWithFieldPrefix = (
  modelName: string,
  idField: string,
  clinicId: string,
  branchId: string,
) => {
  return async function (this: any, next: (error?: any) => void) {
    if (!this.isNew && this[idField]) {
      return next(); // Skip this hook if the document is not new or the ID is already set
    }

    try {
      // Build up the prefix: e.g. clinicId + branchId
      let prefix = '';
      if (this[clinicId] && this[branchId]) {
        prefix = `${this[clinicId]}${this[branchId]}`;
      }

      // Create a unique _id for the counters collection
      // e.g. "patients-EVKN" or "patients-EVLK"
      const fullCounterId = prefix ? `${modelName}-${prefix}` : modelName;

      // Increment the counter
      const doc = await Counters.findOneAndUpdate(
        { _id: fullCounterId },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, session: this.$session() },
      );

      if (!doc) {
        throw new Error('Counter document not found');
      }

      const id = prefix ? `${prefix}-${doc.seq}` : `${doc.seq}`;
      this[idField] = id;

      next();
    } catch (error) {
      next(error); // Forward any errors to Mongoose's error handling
    }
  };
};
