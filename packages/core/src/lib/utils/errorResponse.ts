import { AxiosError } from "axios";
import { APIGatewayProxyResult } from "aws-lambda";

import ErrorMessage from "./errorMessage";

function errorResponse(error: unknown): APIGatewayProxyResult {
  let statusCode = 500;
  let message = "An unknown error occurred";

  if (error instanceof ErrorMessage) {
    console[error.code >= 400 ? "error" : "log"]("ErrorMessage", error);
    statusCode = error.code || 500;
    message = error.message;
  } else if (error instanceof AxiosError) {
    console[error.response?.status! >= 400 ? "error" : "log"](
      "AxiosError",
      error.response?.data || error.toJSON()
    );
    statusCode = error.response?.status || 500;
    message = error.response?.data.message || message; // Assuming `data` has a `message` property.
  } else {
    console.error("Unexpected Error", error);
  }

  return {
    statusCode,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "error",
      message,
    }),
  };
}

export default errorResponse;
