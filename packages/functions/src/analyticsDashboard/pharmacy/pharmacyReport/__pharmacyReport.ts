import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import { PatientPharmacy } from '@evara-backend/core/src/models/patientDashboard/PatientPharmacy';
import Patient from '@evara-backend/core/models/Patients';
import Doctors from '@evara-backend/core/src/models/mastersDashboard/Doctors';
import { PharmacyStock } from '@evara-backend/core/src/models/pharmacyDashboard/PharmacyStock';
import { DrugLocation } from '@evara-backend/core/src/models/pharmacyDashboard/DrugLocation';
import { DrugItem } from '@evara-backend/core/src/models/pharmacyDashboard/DrugItem';
import { DrugCategory } from '@evara-backend/core/src/models/pharmacyDashboard/DrugCategory';
import { DrugType } from '@evara-backend/core/src/models/pharmacyDashboard/DrugType';
import { DrugVendor } from '@evara-backend/core/src/models/pharmacyDashboard/DrugVendor';
import { getISTDateRangeBounds } from '@evara-backend/core/src/lib/utils/formatDateIST';

interface FetchPharmacyReportParams {
  clinicId: string;
  branchId: string;
  page?: number;
  limit?: number;
  saleStartDate?: string;
  saleEndDate?: string;
  fetchAllData?: boolean;
}

export const fetchPharmacyReportData = async (
  params: FetchPharmacyReportParams,
) => {
  await connectMongoDb();

  const {
    clinicId,
    branchId,
    page = 1,
    limit = 25,
    saleStartDate,
    saleEndDate,
    fetchAllData = false,
  } = params;

  const query: any = { clinicId, branchId };
  const { start, end } = getISTDateRangeBounds(saleStartDate, saleEndDate);
  if (start || end) {
    query.createdAt = {
      ...(start && { $gte: start }),
      ...(end && { $lte: end }),
    };
  }

  const populatePaths = [
    {
      path: 'item.stock',
      model: PharmacyStock.modelName,
      populate: [
        {
          path: 'item',
          model: DrugItem.modelName,
          populate: [
            { path: 'category', model: DrugCategory.modelName },
            { path: 'type', model: DrugType.modelName },
          ],
        },
        { path: 'batches.locations.location', model: DrugLocation.modelName },
        { path: 'batches.vendor', model: DrugVendor.modelName },
      ],
    },
    { path: 'doctor', model: Doctors.modelName },
    { path: 'item.details.location', model: DrugLocation.modelName },
  ];

  let recordsQuery = PatientPharmacy.find(query)
    .populate(populatePaths)
    .sort({ date: -1 })
    .lean();

  if (!fetchAllData) {
    recordsQuery = recordsQuery.skip((page - 1) * limit).limit(limit);
  }

  const pharmacyData = await recordsQuery;

  const patientIds = Array.from(
    new Set(
      pharmacyData
        .map(record => record.patient)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const patientData = await Patient.find({
    patientId: { $in: patientIds },
  }).lean();

  const patientMap: Record<string, any> = patientData.reduce(
    (map, patient) => {
      map[patient.patientId] = patient;
      return map;
    },
    {} as Record<string, any>,
  );

  return pharmacyData.map(record => {
    const patientDetails = patientMap[record.patient] || {};
    const totalQuantity = (record.item?.details || []).reduce(
      (sum: number, detail: any) => sum + (detail.quantity || 0),
      0,
    );
    const totalItemPrice = (record.item?.details || []).reduce(
      (sum: number, detail: any) => {
        const packSize = detail.packSize || 1;
        return sum + ((detail.mrp || 0) / packSize) * (detail.quantity || 0);
      },
      0,
    );

    return {
      ...record,
      totalQuantity,
      totalItemPrice,
      patientName:
        `${patientDetails.firstName || ''} ${patientDetails.lastName || ''}`.trim(),
      drugName: (record as any).item?.stock?.item?.name || '',
      hsnCode: (record as any).item?.stock?.item?.hsnCode || '',
      batchNumber: record.item?.details?.[0]?.batchNumber || '',
      expiryDate: record.item?.details?.[0]?.expiryDate || null,
    };
  });
};
