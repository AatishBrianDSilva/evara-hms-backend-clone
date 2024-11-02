import { PaginateResult } from 'mongoose';
import { IPagination } from '../types/pagination';

function formatPaginationResult<T>(result: PaginateResult<T>): {
  records: T[];
  pagination: IPagination;
} {
  const pagination: IPagination = {
    totalDocs: result.totalDocs,
    limit: result.limit,
    totalPages: result.totalPages,
    page: result.page,
    pagingCounter: result.pagingCounter,
    hasPrevPage: result.hasPrevPage,
    hasNextPage: result.hasNextPage,
    prevPage: result.prevPage || null,
    nextPage: result.nextPage || null,
  };

  // Return the formatted records and pagination details
  return {
    records: result.docs.map(record =>
      record.toJSON ? record.toJSON() : record,
    ),
    pagination,
  };
}

export default formatPaginationResult;
