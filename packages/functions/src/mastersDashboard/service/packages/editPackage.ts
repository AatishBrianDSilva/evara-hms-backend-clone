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

  console.log('Received event:', JSON.stringify(event, null, 2));

  const auth = extractAuthorizerDetails(event);
  console.log('Extracted auth details:', auth);

  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await connectMongoDb();
    console.log('Connected to MongoDB');

    if (!event.body) {
      console.log('Error: No data provided in the request body');
      throw new ErrorMessage(400, 'Data is required');
    }

    // Parse the body from the event
    console.log('Parsing request body...');
    const data = JSON.parse(event.body);
    console.log('Parsed data:', data);

    // Check if the package ID is provided
    if (!data.id) {
      console.log('Error: No package ID provided');
      throw new ErrorMessage(400, 'Package ID is required');
    }

    // Find the package by ID
    const packageToUpdate = await MasterPackage.findById(data.id);

    if (!packageToUpdate) {
      console.log(`Error: No package found with ID ${data.id}`);
      throw new ErrorMessage(404, `No package found with ID ${data.id}`);
    }

    // Update the `isActive` field for the package
    if (typeof data.isActive !== 'undefined') {
      packageToUpdate.active = data.isActive;
      console.log(`Updating package isActive to ${data.isActive}`);
    } else {
      console.log('Error: isActive field is not provided');
      throw new ErrorMessage(400, 'isActive field is required');
    }

    // Function to update the isActive status of an item
    const updateItemIsActive = async (
      itemType: string,
      itemId: string,
      isActive: boolean,
    ) => {
      let itemModel:
        | typeof MasterProcedures
        | typeof MasterInvestigation
        | typeof MasterCryoPreservations
        | typeof MasterService
        | typeof MasterTreatmentCycle;

      switch (itemType) {
        case 'procedure':
          itemModel = MasterProcedures;
          break;
        case 'investigation':
          itemModel = MasterInvestigation;
          break;
        case 'cryoPreservation':
          itemModel = MasterCryoPreservations;
          break;
        case 'service':
          itemModel = MasterService;
          break;
        case 'cycle':
          itemModel = MasterTreatmentCycle;
          break;
        default:
          console.log(`Error: Invalid item type ${itemType}`);
          throw new ErrorMessage(400, `Invalid item type ${itemType}`);
      }

      const item = await (itemModel as any).findById(itemId).exec(); // Cast `itemModel` to `any` temporarily to bypass TypeScript overload issues
      if (item) {
        item.active = isActive;
        await item.save();
        console.log(`${itemType} item with ID ${itemId} updated successfully`);
      } else {
        console.log(`Error: No ${itemType} found with ID ${itemId}`);
        throw new ErrorMessage(404, `No ${itemType} found with ID ${itemId}`);
      }
    };

    // Update the `isActive` field for associated items
    const { procedures, investigations, cryoPreservations, services, cycles } =
      data;

    if (procedures && procedures.length > 0) {
      for (const procedure of procedures) {
        await updateItemIsActive('procedure', procedure.id, data.isActive);
      }
    }

    if (investigations && investigations.length > 0) {
      for (const investigation of investigations) {
        await updateItemIsActive(
          'investigation',
          investigation.id,
          data.isActive,
        );
      }
    }

    if (cryoPreservations && cryoPreservations.length > 0) {
      for (const cryoPreservation of cryoPreservations) {
        await updateItemIsActive(
          'cryoPreservation',
          cryoPreservation.id,
          data.isActive,
        );
      }
    }

    if (services && services.length > 0) {
      for (const service of services) {
        await updateItemIsActive('service', service.id, data.isActive);
      }
    }

    if (cycles && cycles.length > 0) {
      for (const cycle of cycles) {
        await updateItemIsActive('cycle', cycle.id, data.isActive);
      }
    }

    // Save the updated package
    const updatedPackage = await packageToUpdate.save();
    console.log(
      'Package and associated items updated successfully:',
      updatedPackage,
    );

    // Return success response
    return successResponse('Package updated successfully', updatedPackage);
  } catch (error) {
    console.log('Error occurred during package update:', error);
    return errorResponse(error);
  }
};
