import { APIGatewayProxyHandler } from "aws-lambda";

import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import ErrorMessage from "@evara-backend/core/src/lib/utils/ErrorMessage";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import MasterCryoPreservations from "@evara-backend/core/src/models/patientDashboard/cryoPreservation/MasterCryoPreservations";
import MasterInvestigation from "@evara-backend/core/src/models/patientDashboard/investigation/MasterInvestigations";
import MasterProcedure from "@evara-backend/core/src/models/patientDashboard/procedure/MasterProcedure";
import MasterService from "@evara-backend/core/src/models/patientDashboard/services/MasterService";
import { PatientBillingEstimation } from "@evara-backend/core/models/patientDashboard/Billings/PatientBillingEstimation";
import { EPatientBillingServiceType } from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling";
import MasterTreatmentCycle from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/MasterTreatmentCycle";
import { extractAuthorizerDetails } from "@evara-backend/core/src/lib/utils/extractAuthorizerDetails";

// Handler function
export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    const auth = extractAuthorizerDetails(event);
    if (!auth) throw new ErrorMessage(401, "Unauthorized");

    await connectMongoDb();
    // Connect to MongoDB

    if (event.body == null) {
      throw new ErrorMessage(400, "Data is required");
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    // Add clinic and branch IDs (these should ideally come from the message or an authenticated context)
    data.clinicId = auth.clinicId;
    data.branchId = auth.branchId;

    for (let item of data.items) {
      item.quantity = item.quantity || 1;

      const service = await findServiceByIdAndType(item.masterServiceId, data.serviceType);

      if (!service) {
        throw new ErrorMessage(404, "Service not found");
      }

      const estimatedPrice = service.cost * item.quantity;
      // const estimatedTax = Math.round((service.tax * estimatedPrice) / 100);
      const estimatedTax = (service.tax * estimatedPrice) / 100;

      // const total = Math.round(estimatedPrice + estimatedTax);
      const total = estimatedPrice + estimatedTax;

      console.log("Adding estimation for service: ", service.name);
      console.log("Item", item);

      const newEstimation = new PatientBillingEstimation({
        clinicId: data.clinicId,
        branchId: data.branchId,
        patientCode: data.patientCode,
        doctorId: item.doctor == "null" ? null : item.doctor,
        masterServiceId: item.masterServiceId,
        serviceName: service.name,
        serviceType: data.serviceType,
        quantity: item.quantity,
        estimatedTax: estimatedTax,
        taxRate: service.tax,
        cost: service.cost,
        estimatedPrice: estimatedPrice,
        estimatedTotal: total,
        status: "Active",
      });

      await newEstimation.save();
    }

    return successResponse("Estimation added successfully");
  } catch (error) {
    return errorResponse(error);
  }
};

export async function findServiceByIdAndType(
  serviceId: string,
  serviceType: EPatientBillingServiceType
) {
  switch (serviceType) {
    case EPatientBillingServiceType.CryoPreservation:
      return MasterCryoPreservations.findById(serviceId);
    case EPatientBillingServiceType.Investigation:
      return MasterInvestigation.findById(serviceId);
    case EPatientBillingServiceType.Procedure:
      return MasterProcedure.findById(serviceId);
    case EPatientBillingServiceType.Service:
      return MasterService.findById(serviceId);
    case EPatientBillingServiceType.TreatmentCycle:
      return MasterTreatmentCycle.findById(serviceId);
    default:
      throw new ErrorMessage(400, "Invalid service type: " + serviceType);
  }
}
