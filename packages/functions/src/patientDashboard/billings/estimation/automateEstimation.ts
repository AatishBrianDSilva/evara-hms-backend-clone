import { SQSEvent, SQSHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import {
  EPatientBillingEstimationStatus,
  PatientBillingEstimation,
} from "@evara-backend/core/models/patientDashboard/Billings/PatientBillingEstimation";
import { findServiceByIdAndType } from "./addEstimation";
import { EPatientBillingServiceType } from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling";
import { PharmacyStock } from "@evara-backend/core/src/models/pharmacyDashboard/PharmacyStock";
import { DrugItem } from "@evara-backend/core/src/models/pharmacyDashboard/DrugItem";
import { DrugCategory } from "@evara-backend/core/src/models/pharmacyDashboard/DrugCategory";
import { DrugType } from "@evara-backend/core/src/models/pharmacyDashboard/DrugType";
import { DrugLocation } from "@evara-backend/core/src/models/pharmacyDashboard/DrugLocation";
import { DrugVendor } from "@evara-backend/core/src/models/pharmacyDashboard/DrugVendor";
import { TaxRate } from "@evara-backend/core/src/models/pharmacyDashboard/TaxRate";

// Handler function for SQS
export const main: SQSHandler = async (event: SQSEvent) => {
  await connectMongoDb(); // Ensure MongoDB is connected

  try {
    // Iterate over each SQS message
    for (const message of event.Records) {
      const payload = JSON.parse(message.body);

      console.log("Processing message", payload.Message);

      const { action, data } = JSON.parse(payload.Message);

      switch (action) {
        case "Add":
          await addEstimation(data);
          break;
        case "Delete":
          await deleteEstimation(data.serviceId);
          break;
        default:
          break;
      }

      // Success processing message
      console.log("Message processed successfully");
    }
  } catch (error) {
    console.error("Error processing SQS message", error);
    throw error; // Throwing error will cause the message to be re-queued and retried
  }
};

// Add estimation function
const addEstimation = async (data: any) => {
  // Add clinic and branch IDs (these should ideally come from the message or an authenticated context)
  data.clinicId = "EV";
  data.branchId = "KL";

  let estimatedPrice: number = 0;
  let estimatedTax: number = 0;
  let total: number = 0;
  let taxRate: number = 0;
  let cost: number = 0;

  if (data.serviceType === EPatientBillingServiceType.Pharmacy) {
    const service: any = await PharmacyStock.findById(data.masterServiceId).populate([
      {
        path: "item",
        model: DrugItem.modelName,
        populate: [
          {
            path: "category",
            model: DrugCategory.modelName,
          },
          {
            path: "type",
            model: DrugType.modelName,
          },
          {
            path: "taxRate",
            model: TaxRate.modelName,
          },
        ],
      },
      {
        path: "batches.locations.location",
        model: DrugLocation.modelName,
      },
      {
        path: "batches.vendor",
        model: DrugVendor.modelName,
      },
      {
        path: "batches.vendor.location",
        model: DrugLocation.modelName,
      },
    ]);

    if (!service) {
      throw new ErrorMessage(404, "Service not found");
    }

    console.log("Service found", service);
    console.log("Service Item", service.item.taxRate);

    const sellPrice = service.sellPrice || 10;
    const tax = service.item?.taxRate?.taxRate || 0;

    const mrp = (data.quantity / service.item.packSize) * sellPrice;

    // estimatedPrice = Math.round(mrp);
    // estimatedTax = Math.round((tax * estimatedPrice) / 100);
    // total = Math.round(estimatedPrice + estimatedTax);

    estimatedPrice = mrp;
    estimatedTax = (tax * estimatedPrice) / 100;
    total = estimatedPrice + estimatedTax;

    taxRate = tax;
    cost = mrp;

    console.log("Success", {
      estimatedPrice,
      estimatedTax,
      total,
    });
  } else {
    const service = await findServiceByIdAndType(data.masterServiceId, data.serviceType);

    if (!service) {
      throw new ErrorMessage(404, "Service not found");
    }

    taxRate = service.tax;
    cost = service.cost;
    estimatedPrice = service.cost * data.quantity;
    estimatedTax = (service.tax * estimatedPrice) / 100;
    total = estimatedPrice + estimatedTax;
  }

  const newEstimation = new PatientBillingEstimation({
    ...data,
    estimatedTax: estimatedTax,
    taxRate: taxRate,
    cost: cost,
    estimatedPrice: estimatedPrice,
    estimatedTotal: total,
    status: "Active",
  });

  await newEstimation.save();

  // Success processing message
  console.log("Estimation added successfully", {
    estimationId: newEstimation._id,
  });
};

// Delete estimation function
const deleteEstimation = async (serviceId: string) => {
  // Add clinic and branch IDs (these should ideally come from the message or an authenticated context)

  // Find and delete the estimation
  const estimation = await PatientBillingEstimation.findOneAndDelete({
    serviceId: serviceId,
  });

  if (!estimation) {
    throw new ErrorMessage(404, "Estimation not found");
  }

  // Success processing message
  console.log("Estimation deleted successfully", {
    estimationId: estimation._id,
  });
};
