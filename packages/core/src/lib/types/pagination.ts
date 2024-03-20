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

export interface IPopulateOptions {
  path: string;
  select?: string;
  model?: string;
  match?: { [key: string]: any };
  options?: { [key: string]: any };
  populate?: IPopulateOptions | IPopulateOptions[]; // Support for nested and multiple populations
}

export interface IPaginateOptions {
  page?: number;
  limit?: number;
  sort?: { [key: string]: any };
  select?: string | object;
  lean?: boolean;
  leanWithId?: boolean;
  populate?: IPopulateOptions | IPopulateOptions[]; // Can be a single object or an array of objects
}
