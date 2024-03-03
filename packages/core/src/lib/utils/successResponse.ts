import { IPagination } from "../types/pagination";

type TSuccessResponse = {
  statusCode: number;
  body: string;
};

const SuccessResponse = (
  message: string,
  data: unknown,
  pagination?: IPagination
): TSuccessResponse => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      status: "success",
      message,
      data,
      pagination,
    }),
  };
};

export default SuccessResponse;
