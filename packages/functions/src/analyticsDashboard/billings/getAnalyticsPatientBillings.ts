import { APIGatewayProxyHandler } from "aws-lambda";
import { connectMongoDb } from "@evara-backend/core/src/lib/db/mongodb";
import errorResponse from "@evara-backend/core/src/lib/utils/errorResponse";
import successResponse from "@evara-backend/core/src/lib/utils/successResponse";
import formatPaginationResult from "@evara-backend/core/src/lib/utils/formatPaginationResult";
import { IPaginateOptions } from "@evara-backend/core/src/lib/types/pagination";
import { log } from "console";
import Doctors from "@evara-backend/core/src/models/mastersDashboard/Doctors";
import { PatientBilling } from "@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling";
import Patient from "@evara-backend/core/models/Patients";
import { extractAuthorizerDetails } from "@evara-backend/core/lib/utils/extractAuthorizerDetails";

interface BillingSummary {
  amount: number;
  payment: number;
  discount: number;
  due: number;
}

// Utility function to parse the combined search query
const parseSearchQuery = (query) => {
  const queryParts = query.split(" ");
  const parsedQuery = {
    patientCode: "",
    patientName: "",
  };

  queryParts.forEach((part) => {
    if (part.startsWith("patientCode:")) {
      parsedQuery.patientCode = part.split(":")[1];
    } else if (part.startsWith("patientName:")) {
      parsedQuery.patientName = part.split(":")[1];
    }
  });

  return parsedQuery;
};

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;
  const auth = extractAuthorizerDetails(event);

  try {
    await connectMongoDb();

    const params = event.queryStringParameters || {};
    const {
      page = "1",
      limit = "10",
      sort: sortRaw,
      status,
      searchQuery = "", // Combined search query for patient code and patient name
    } = params;

    const sort = sortRaw ? JSON.parse(sortRaw) : undefined;

    // Parse the combined search query
    const { patientCode, patientName } = parseSearchQuery(searchQuery);

    const query: any = {};
    query.clinicId = auth.clinicId;
    if (status) {
      query.status = status;
    }

    // Handle patientCode and patientName filters
    let patientCodeFilter: any = {};

    if (patientCode) {
      patientCodeFilter = { patientCode: new RegExp(patientCode, "i") };
    }

    if (patientName) {
      // Fetch matching patients
      const matchingPatients = await Patient.find({
        clinicId: auth.clinicId,
        $or: [
          { firstName: { $regex: patientName, $options: "i" } },
          { lastName: { $regex: patientName, $options: "i" } },
        ],
      }).select("patientId");

      const matchingPatientCodes = matchingPatients.map((p) => p.patientId);

      if (matchingPatientCodes.length === 0) {
        // No matching patients, so set query to return no results
        query.patientCode = "__NO_MATCH__"; // This will not match any patientCode
      } else {
        if (patientCode) {
          // Combine patientCode and patientName filters
          query.$and = [
            { patientCode: new RegExp(patientCode, "i") },
            { patientCode: { $in: matchingPatientCodes } },
          ];
        } else {
          query.patientCode = { $in: matchingPatientCodes };
        }
      }
    } else if (patientCode) {
      query.patientCode = patientCodeFilter.patientCode;
    }

    const options: IPaginateOptions = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort,
      populate: [
        {
          path: "items.doctorId",
          model: Doctors.modelName,
        },
      ],
    };

    log("Query", query);

    // Fetching the billings with pagination
    const result = await PatientBilling.paginate(query, options);
    const { records, pagination } = formatPaginationResult(result);

    // Extract unique patient IDs from the billing records
    const patientIds = Array.from(
      new Set(records.map((record) => record.patientCode))
    );

    // Fetch patient details using the extracted patient IDs
    const patientData = await Patient.find({
      patientId: { $in: patientIds },
    }).lean();

    // Map patients to a dictionary for easy lookup
    const patientMap = patientData.reduce((map, patient) => {
      map[patient.patientId] = patient;
      return map;
    }, {});

    // Combine patient details with billing records
    const combinedData = records.map((record) => {
      const patientDetails = patientMap[record.patientCode] || {};

      // Construct the patientName from fetched patient details
      const patientName = `${patientDetails.firstName || ""} ${
        patientDetails.lastName || ""
      }`.trim();

      return {
        ...record,
        patientName, // Include the constructed patient name
      };
    });

    // No need to filter combinedData by patientName here since it's already applied in the query

    const summary = calculateSummary(combinedData);

    return successResponse("Success", {
      records: combinedData,
      pagination,
      summary: summary,
    });
  } catch (error) {
    return errorResponse(error);
  }
};

function calculateSummary(billings): BillingSummary {
  return billings.reduce<BillingSummary>(
    (acc, billing) => {
      const total = billing.subTotal;
      const totalPaid = billing.payments
        .filter((payment) => payment.type === "Payment")
        .reduce((sum, payment) => sum + payment.amount, 0);

      acc.amount += total;
      acc.payment += totalPaid;
      acc.discount += billing.discount;
      acc.due += total - totalPaid - billing.discount;

      return acc;
    },
    { amount: 0, payment: 0, discount: 0, due: 0 }
  );
}
