import mongoose, { Schema } from 'mongoose';
import { EPatientBillingServiceType } from '../../patientDashboard/Billings/PatientBilling';

interface report {
  category: EPatientBillingServiceType;
  name: string;
  template: string;
  notes: string;
}

const reportSchema = new Schema<report>({
  category: {
    type: String,
    enum: Object.values(EPatientBillingServiceType),
    required: true,
  },
  name: { type: String, required: true },
  template: { type: String, required: true },
  notes: { type: String, required: true },
});

const Report = mongoose.model<report>('Report', reportSchema);

export default Report;
