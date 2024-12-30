// services/allocationService.ts

import mongoose from 'mongoose';
import { PatientPharmacy } from '@evara-backend/core/src/models/patientDashboard/PatientPharmacy';
import { PharmacyStock } from '@evara-backend/core/src/models/pharmacyDashboard/PharmacyStock';
import {
  PatientBillingEstimation,
  EPatientBillingEstimationStatus,
} from '@evara-backend/core/src/models/patientDashboard/Billings/PatientBillingEstimation';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';

/**
 * Deletes a patient pharmacy allocation and restocks the pharmacy items.
 *
 * @param allocationId - The ID of the patient pharmacy allocation to delete.
 * @param session - The MongoDB session for transaction management.
 * @throws {ErrorMessage} If any validation fails or operations fail.
 */
export const deleteAndRestockPharmacy = async (
  allocationId: string,
  session: mongoose.ClientSession,
): Promise<void> => {
  // Fetch the patient pharmacy allocation
  const allocation =
    await PatientPharmacy.findById(allocationId).session(session);
  if (!allocation) {
    throw new ErrorMessage(404, 'Patient allocation not found');
  }

  // // Fetch the related estimation
  // const estimation = await PatientBillingEstimation.findOne({
  //   serviceId: allocation._id,
  //   serviceType: 'Pharmacy',
  // }).session(session);

  // if (!estimation) {
  //   throw new ErrorMessage(404, 'Estimation not found for this allocation');
  // }

  // // Check if the estimation is inactive
  // if (estimation.status === EPatientBillingEstimationStatus.Inactive) {
  //   throw new ErrorMessage(
  //     400,
  //     'Cannot delete allocation as the bill has already been created',
  //   );
  // }

  // Proceed to restock the pharmacy items
  for (const item of allocation.item.details) {
    const stockId = allocation.item.stock;
    const stock = await PharmacyStock.findById(stockId).session(session);
    if (!stock) {
      throw new ErrorMessage(
        404,
        `Pharmacy Stock with ID ${stockId} not found`,
      );
    }

    // Find the relevant batch
    const batch = stock.batches.find(b => b.batchNo === item.batchNumber);
    if (!batch) {
      throw new ErrorMessage(
        400,
        `Batch number ${item.batchNumber} not found in stock`,
      );
    }

    // Find the location within the batch
    const locationQuantity = batch.locations.find(
      l => l.location.toString() === item.location.toString(),
    );
    if (!locationQuantity) {
      throw new ErrorMessage(400, 'Location not found in batch');
    }

    // Restock the quantity
    locationQuantity.quantity += item.quantity;

    // Update the total quantity in stock
    stock.totalQuantity += item.quantity;

    await stock.save({ session });
  }

  // Delete the patient pharmacy allocation
  await PatientPharmacy.findByIdAndDelete(allocationId).session(session);

  // // Delete the estimation
  // await PatientBillingEstimation.findByIdAndDelete(estimation._id).session(session);
};
