import { APIGatewayProxyEvent, APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/lib/db/mongodb";
import successResponse from "@evara-backend/core/lib/utils/successResponse";
import errorResponse from "@evara-backend/core/lib/utils/errorResponse";
import ErrorMessage from "@evara-backend/core/lib/utils/errorMessage";
import { log } from "console";
import PatientTreatmentCycle from "@evara-backend/core/src/models/treatmentCycle/PatientTreatmentCycle";
import { ETreatmentCycleCategoryKey } from "@evara-backend/core/src/models/treatmentCycle/DefaultTreatmentCycle";
import { Document } from "mongoose";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    await connectMongoDb();

    if (!event.pathParameters) {
      throw new ErrorMessage(400, "Path parameters are null");
    }

    const id = event.pathParameters["id"];
    if (!id) {
      throw new ErrorMessage(400, "Id is not provided");
    }

    // Extract query string parameters
    const params = event.queryStringParameters || {};
    const { ...conditions } = params;

    if (!conditions.editType || !conditions.category) {
      throw new ErrorMessage(400, "Edit type and category are required");
    }

    if (!event.body) {
      throw new ErrorMessage(400, "Data is required");
    }

    const body = JSON.parse(event.body);

    if (conditions.editType === "update") {
      body.status = "Completed";
    } else if (conditions.editType === "reset") {
      body.status = "Pending";
    }

    log("conditions", conditions);
    log("body", body);

    if (conditions.category in ETreatmentCycleCategoryKey) {
      await updateCategory(
        id,
        body,
        conditions.category as keyof typeof ETreatmentCycleCategoryKey
      );
    } else {
      throw new ErrorMessage(400, `Invalid category: ${conditions.category}`);
    }

    await updateStatus(id);

    return successResponse("TreatmentCycle Updated successfully");
  } catch (error) {
    return errorResponse(error);
  }
};

async function updateCategory(
  id: string,
  body: any,
  category: keyof typeof ETreatmentCycleCategoryKey
): Promise<Document | null> {
  // Construct the MongoDB update paths dynamically based on the category
  const statusPath = `${category}.$.status`;
  const detailsPath = `${category}.$.details`;

  // MongoDB query to update the specific category subdocument
  const result = await PatientTreatmentCycle.findOneAndUpdate(
    {
      _id: id,
      [`${category}._id`]: body.documentId,
    },
    {
      $set: {
        [statusPath]: body.status,
        [detailsPath]: body.details,
      },
    },
    { new: true }
  );

  if (!result) {
    console.error("No document found or updated for category:", category);
  } else {
    console.log(`Update successful for category: ${category}`, result);
  }

  return result;
}

const updateStatus = async (id: string) => {
  const treatmentCycle = await PatientTreatmentCycle.findById(id).lean();
  if (!treatmentCycle) {
    throw new ErrorMessage(404, "TreatmentCycle not found");
  }

  let status = "Pending"; // Default to "Pending"

  const categories = [
    ETreatmentCycleCategoryKey.protocols,
    ETreatmentCycleCategoryKey.checklists,
    ETreatmentCycleCategoryKey.reports,
    ETreatmentCycleCategoryKey.metrics,
  ];

  const isAnyCompleted = categories.some((category) =>
    treatmentCycle[category].some((item) => item.status === "Completed")
  );

  const isAllCompleted = categories.every((category) =>
    treatmentCycle[category].every((item) => item.status === "Completed")
  );

  // Adjust status based on the checks
  if (isAllCompleted) {
    status = "Completed";
  } else if (isAnyCompleted) {
    status = "In-Progress";
  } // If neither is true, status remains "Pending"

  log("status", status);

  await PatientTreatmentCycle.findByIdAndUpdate(id, {
    $set: { status: status },
  });
};
