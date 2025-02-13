import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import MasterPackage from '@evara-backend/core/src/models/patientDashboard/packages/MasterPackage';

interface FetchMasterPackagesDataParams {
  clinicId: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  search?: string;
  fetchAllData?: boolean;
}

export const fetchMasterPackagesData = async (
  params: FetchMasterPackagesDataParams,
) => {
  await connectMongoDb();

  const {
    clinicId,
    startDate,
    endDate,
    page = 1,
    limit = 10,
    search = '',
    fetchAllData = false,
  } = params;

  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  const skip = (pageNumber - 1) * limitNumber;

  // Base match query
  const matchQuery: any = { clinicId };

  // Apply date filter
  if (startDate || endDate) {
    const dateQuery: any = {};
    if (startDate) dateQuery.$gte = new Date(startDate);
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      dateQuery.$lte = endOfDay;
    }
    matchQuery.createdAt = dateQuery;
  }

  // Apply search filter
  if (search) {
    matchQuery.name = { $regex: search, $options: 'i' };
  }

  // Define aggregation pipeline
  const pipeline: any[] = [
    { $match: matchQuery },
    {
      $project: {
        name: 1,
        createdAt: 1,
        price: '$cost',
        investigations: reduceArrayToString('$investigations'),
        procedures: reduceArrayToString('$procedures'),
        cryoPreservations: reduceArrayToString('$cryoPreservations'),
        services: reduceArrayToString('$services'),
        treatments: reduceArrayToString('$treatmentCycles'),
      },
    },
  ];

  // Apply pagination if not fetching all data
  if (!fetchAllData) {
    pipeline.push({
      $facet: {
        records: [{ $skip: skip }, { $limit: limitNumber }],
        totalCount: [{ $count: 'count' }],
      },
    });

    const res = await MasterPackage.aggregate(pipeline);
    const { records, totalCount } = res[0] || { records: [], totalCount: [] };
    const totalDocs = totalCount.length ? totalCount[0].count : 0;

    return {
      records,
      pagination: {
        totalDocs,
        page: pageNumber,
        limit: limitNumber,
      },
    };
  } else {
    const records = await MasterPackage.aggregate(pipeline);
    return { records };
  }
};

/**
 * Helper function to convert an array field into a comma-separated string.
 */
function reduceArrayToString(arrayField: string) {
  return {
    $reduce: {
      input: arrayField,
      initialValue: '',
      in: {
        $concat: [
          { $cond: { if: { $eq: ['$$value', ''] }, then: '', else: ', ' } },
          '$$this.name',
        ],
      },
    },
  };
}
