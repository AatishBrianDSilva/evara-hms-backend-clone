import { APIGatewayProxyHandler } from 'aws-lambda';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  console.log('🔄 OPTIONS preflight request for purchase order status update');
  console.log('Origin:', event.headers.origin || event.headers.Origin);
  console.log(
    'Requested Method:',
    event.headers['access-control-request-method'],
  );

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'Content-Type,Authorization,X-Requested-With',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Max-Age': '86400',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'CORS preflight OK for purchase order status update',
      allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      timestamp: new Date().toISOString(),
    }),
  };
};
