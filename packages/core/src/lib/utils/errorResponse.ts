import { AxiosError } from "axios";
import { APIGatewayProxyResult } from "aws-lambda";

import ErrorMessage from "./errorMessage";

function ErrorResponse(error: unknown): APIGatewayProxyResult {
  if (error instanceof ErrorMessage) {
    // Type check
    if (error?.code >= 400) {
      console.error("Error", error);
    } else {
      console.log("Error", error);
    }
    return {
      statusCode: error.code || 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        status: "error",
        message: error.message,
      }),
    };
  }

  if (error instanceof AxiosError) {
    // Type check
    if (error.response?.status! >= 400) {
      console.error("AxiosError", error.response?.data);
    } else {
      console.log("AxiosError", error.toJSON());
    }

    return {
      statusCode: error.response?.status || 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: error.response?.data || "An unkown error occured",
        status: error.response?.status || "error",
      }),
    };
  }
  console.error("Error", error);
  return {
    statusCode: 500,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "error",
      message: "An unkown error occured",
    }),
  };
}

export default ErrorResponse;
