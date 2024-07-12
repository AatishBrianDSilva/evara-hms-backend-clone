import { APIGatewayProxyHandler } from "aws-lambda";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import Patient from "@evara-backend/core/src/models/Patients";
import PatientInvestigation from "@evara-backend/core/src/models/patientDashboard/investigation/PatientInvestigation";
import PatientProcedure from "@evara-backend/core/src/models/patientDashboard/procedure/PatientProcedure";
import PatientService from "@evara-backend/core/src/models/patientDashboard/services/PatientService";
import PatientTreatmentCycle from "@evara-backend/core/src/models/patientDashboard/treatmentCycle/PatientTreatmentCycle";
import PatientCryoPreservation from "@evara-backend/core/src/models/patientDashboard/cryoPreservation/PatientCryoPreservation";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb();
    console.log("Connected to MongoDB");

    const params = event.queryStringParameters || {};
    const { patientId } = params;

    if (!patientId) {
      console.error("Patient ID is required");
      return errorResponse(new Error("Patient ID is required"));
    }

    console.log(`Fetching patient with ID: ${patientId}`);
    const patient = await Patient.findOne({ patientId }).lean();
    if (!patient) {
      console.error("Patient not found");
      return errorResponse(new Error("Patient not found"));
    }

    console.log(`Fetching investigations for patient ID: ${patient._id}`);
    const investigationsPromise = PatientInvestigation.aggregate([
      { $match: { patient: patient._id } },
      {
        $lookup: {
          from: "masterinvestigations",
          localField: "investigation",
          foreignField: "_id",
          as: "investigationDetails",
        },
      },
      { $unwind: "$investigationDetails" },
      {
        $project: {
          _id: 1,
          date: 1,
          status: 1,
          type: { $literal: "Investigations" },
          name: "$investigationDetails.name",
        },
      },
    ]);

    console.log(`Fetching procedures for patient ID: ${patient._id}`);
    const proceduresPromise = PatientProcedure.aggregate([
      { $match: { patient: patient._id } },
      {
        $lookup: {
          from: "masterprocedures",
          localField: "procedure",
          foreignField: "_id",
          as: "procedureDetails",
        },
      },
      { $unwind: "$procedureDetails" },
      {
        $project: {
          _id: 1,
          date: 1,
          status: 1,
          type: { $literal: "Procedure" },
          name: "$procedureDetails.name",
        },
      },
    ]);

    console.log(`Fetching services for patient ID: ${patient._id}`);
    const servicesPromise = PatientService.aggregate([
      { $match: { patient: patient._id } },
      {
        $lookup: {
          from: "masterservices",
          localField: "service",
          foreignField: "_id",
          as: "serviceDetails",
        },
      },
      { $unwind: "$serviceDetails" },
      {
        $project: {
          _id: 1,
          date: 1,
          type: { $literal: "Services" },
          name: "$serviceDetails.name",
        },
      },
    ]);

    console.log(`Fetching treatment cycles for patient ID: ${patient._id}`);
    const cyclesPromise = PatientTreatmentCycle.aggregate([
      { $match: { patient: patient._id } },
      {
        $lookup: {
          from: "mastertreatmentcycles",
          localField: "cycle",
          foreignField: "_id",
          as: "cycleDetails",
        },
      },
      { $unwind: "$cycleDetails" },
      {
        $project: {
          _id: 1,
          date: 1,
          status: 1,
          type: { $literal: "Cycle" },
          name: "$cycleDetails.name",
        },
      },
    ]);

    console.log(`Fetching cryo preservations for patient ID: ${patient._id}`);
    const cryoPreservationsPromise = PatientCryoPreservation.aggregate([
      { $match: { patient: patient._id } },
      {
        $lookup: {
          from: "mastercryopreservations",
          localField: "cryo",
          foreignField: "_id",
          as: "cryoDetails",
        },
      },
      { $unwind: "$cryoDetails" },
      {
        $project: {
          _id: 1,
          date: 1,
          status: 1,
          type: { $literal: "CryoPreservation" },
          name: "$cryoDetails.name",
        },
      },
    ]);

    const [investigations, procedures, services, cycles, cryoPreservations] = await Promise.all([
      investigationsPromise,
      proceduresPromise,
      servicesPromise,
      cyclesPromise,
      cryoPreservationsPromise,
    ]);

    const aggregatedData = transformAndAggregateData(
      investigations,
      procedures,
      services,
      cycles,
      cryoPreservations
    );

    return successResponse("Success", aggregatedData);
  } catch (error) {
    console.error("Error:", error);
    return errorResponse(error);
  }
};

const transformAndAggregateData = (
  investigations,
  procedures,
  services,
  cycles,
  cryoPreservations
) => {
  const timeline = {};

  // Helper function to add items to the timeline
  const addItemToTimeline = (item) => {
    const date = new Date(item.date);
    // Adjust for IST (UTC+5:30)
    const istDate = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
    const dateString = istDate.toISOString().split("T")[0];
    if (!timeline[dateString]) {
      timeline[dateString] = [];
    }
    timeline[dateString].push(item);
  };

  // Add all items to the timeline
  investigations.forEach(addItemToTimeline);
  procedures.forEach(addItemToTimeline);
  services.forEach(addItemToTimeline);
  cycles.forEach(addItemToTimeline);
  cryoPreservations.forEach(addItemToTimeline);

  const sortedTimeline = Object.keys(timeline)
    .sort((a, b) => new Date(b) - new Date(a))
    .map((date) => ({ date, items: timeline[date] }));

  return sortedTimeline;
};
