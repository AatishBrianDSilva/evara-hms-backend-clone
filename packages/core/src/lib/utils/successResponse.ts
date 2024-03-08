import { APIGatewayProxyResult } from "aws-lambda";

const SuccessResponse = (
  message: string,
  data?: unknown
): APIGatewayProxyResult => {
  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "success",
      message,
      data,
    }),
  };
};

export default SuccessResponse;
