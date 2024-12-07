import { APIGatewayProxyHandler } from 'aws-lambda';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import MasterPackage from '@evara-backend/core/src/models/patientDashboard/packages/MasterPackage';
import MasterProcedures from '@evara-backend/core/src/models/patientDashboard/procedure/MasterProcedure';
import MasterInvestigation from '@evara-backend/core/models/patientDashboard/investigation/MasterInvestigations';
import MasterCryoPreservations from '@evara-backend/core/models/patientDashboard/cryoPreservation/MasterCryoPreservations';
import MasterService from '@evara-backend/core/models/patientDashboard/services/MasterService';
import MasterTreatmentCycle from '@evara-backend/core/src/models/patientDashboard/treatmentCycle/MasterTreatmentCycle';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import ErrorMessage from '@evara-backend/core/lib/utils/ErrorMessage';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const auth = extractAuthorizerDetails(event);

  try {
    // Connect to MongoDB
    await connectMongoDb();

    if (!event.body) {
      throw new ErrorMessage(400, 'Data is required');
    }

    // Parse the body from the event
    const data = JSON.parse(event.body);

    // Add the clinicId from the authorization details
    data.clinicId = auth.clinicId;
    data.branchId = auth.branchId;

    // Initialize package data
    const packageData = {
      name: data.name,
      cost: data.price, // Rename price to cost
      total: data.total || 0, // Add total field, default to 0 if not provided
      validTill: data.validTill,
      active: data.active,
      clinicId: data.clinicId,
      branchId: data.branchId,
      gender: data.gender,

      procedures: [],
      investigations: [],
      treatmentCycles: [],
      cryoPreservations: [],
      services: [],
    };

    // Function to save a master procedure
    const saveMasterProcedure = async (item: any) => {
      const procedure = new MasterProcedures({
        clinicId: data.clinicId,
        branchId: data.branchId,
        name: item.name,
        procedureType: item.procedureType,
        gender: item.gender,
        validTill: item.validTill,
        isPackageItem: true,
        procedure: item.procedure,
        total: 0, // Set as 0
        cost: 0,
      });

      const savedProcedure = await procedure.save();
      return savedProcedure._id;
    };

    // Function to save a master investigation
    const saveMasterInvestigation = async (item: any) => {
      const investigation = new MasterInvestigation({
        clinicId: data.clinicId,
        branchId: data.branchId,
        name: item.name,
        testType: item.testType,
        gender: item.gender,
        validTill: item.validTill,
        isPackageItem: true,
        test: item.investigation,
        total: 0, // Set as 0
        cost: 0,
      });
      const savedInvestigation = await investigation.save();
      return savedInvestigation._id;
    };

    // Function to save a master cryo preservation
    const saveMasterCryoPreservation = async (item: any) => {
      const cryoPreservation = new MasterCryoPreservations({
        clinicId: data.clinicId,
        branchId: data.branchId,
        name: item.name,
        cryoPreservationType: item.cryoPreservationType,
        gender: item.gender,
        validTill: item.validTill,
        isPackageItem: true,
        cryoPreservation: item.cryoPreservation,
        total: 0, // Set as 0
        cost: 0,
      });
      const savedCryoPreservation = await cryoPreservation.save();
      return savedCryoPreservation._id;
    };

    // Function to save a master service
    const saveMasterService = async (item: any) => {
      const service = new MasterService({
        clinicId: data.clinicId,
        branchId: data.branchId,
        name: item.name,
        serviceType: item.serviceType,
        gender: item.gender,
        validTill: item.validTill,
        isPackageItem: true,
        service: item.service,
        total: 0, // Set as 0
        cost: 0,
      });
      const savedService = await service.save();
      return savedService._id;
    };

    // Function to save a master treatment cycle
    const saveMasterTreatmentCycle = async (item: any) => {
      const treatmentCycle = new MasterTreatmentCycle({
        clinicId: data.clinicId,
        branchId: data.branchId,
        name: item.name,
        cycleType: item.cycleType,
        gender: item.gender,
        validTill: item.validTill,
        isPackageItem: true,
        treatmentCycle: item.cycle,
        total: 0, // Set as 0
        cost: 0,
      });
      const savedTreatmentCycle = await treatmentCycle.save();
      return savedTreatmentCycle._id;
    };

    // Saving procedures
    for (const item of data.procedures) {
      const savedProcedureId = await saveMasterProcedure(item);
      // Update the package data with the newly generated _id
      item.procedure = savedProcedureId;
      packageData.procedures.push({ ...item, itemId: savedProcedureId });
    }

    // Saving investigations
    for (const item of data.investigations) {
      const savedInvestigationId = await saveMasterInvestigation(item);
      // Update the package data with the newly generated _id
      item.investigation = savedInvestigationId;
      packageData.investigations.push({
        ...item,
        itemId: savedInvestigationId,
      });
    }

    // Saving cryo preservations
    for (const item of data.cryoPreservations) {
      const savedCryoPreservationId = await saveMasterCryoPreservation(item);
      // Update the package data with the newly generated _id
      item.cryoPreservation = savedCryoPreservationId;
      packageData.cryoPreservations.push({
        ...item,
        itemId: savedCryoPreservationId,
      });
    }

    // Saving services
    for (const item of data.services) {
      const savedServiceId = await saveMasterService(item);
      // Update the package data with the newly generated _id
      item.service = savedServiceId;
      packageData.services.push({ ...item, itemId: savedServiceId });
    }

    // Saving treatment cycles
    for (const item of data.cycles) {
      const savedTreatmentCycleId = await saveMasterTreatmentCycle(item);
      // Update the package data with the newly generated _id
      item.cycle = savedTreatmentCycleId;
      packageData.treatmentCycles.push({
        ...item,
        itemId: savedTreatmentCycleId,
      });
    }

    // Create and save the master package
    console.log('Creating new MasterPackage with updated data:', packageData);
    const newPackage = new MasterPackage(packageData);
    const savedPackage = await newPackage.save();
    console.log('New package created successfully:', savedPackage);

    // Return success response
    return successResponse('Package created successfully', savedPackage);
  } catch (error) {
    console.log('Error occurred during package creation:', error);
    return errorResponse(error);
  }
};
