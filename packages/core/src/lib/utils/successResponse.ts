type TSuccessResponse = {
  statusCode: number;
  body: string;
};

const SuccessResponse = (message: string, data: unknown): TSuccessResponse => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      status: "success",
      message,
      data,
    }),
  };
};

export default SuccessResponse;
