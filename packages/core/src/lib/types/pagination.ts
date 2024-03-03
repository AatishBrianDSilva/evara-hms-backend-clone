export interface IPagination {
  totalDocs: number;
  limit: number;
  totalPages: number;
  page: number | undefined;
  pagingCounter: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number | null | undefined;
  nextPage: number | null | undefined;
}

export interface IPaginateOptions {
  page?: number;
  limit?: number;
  sort?: { [key: string]: any };
  select?: string;
  lean?: boolean;
  leanWithId?: boolean;
}
