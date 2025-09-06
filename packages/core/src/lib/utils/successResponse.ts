import { APIGatewayProxyResult } from 'aws-lambda';

const successResponse = (
  message: string,
  data?: unknown,
): APIGatewayProxyResult => {
  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    },
    body: JSON.stringify({
      status: 'success',
      message,
      data,
    }),
  };
};

export default successResponse;
