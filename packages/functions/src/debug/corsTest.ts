import { APIGatewayProxyHandler } from 'aws-lambda';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  console.log('🔍 CORS Debug - Incoming Request:');
  console.log('Method:', event.httpMethod);
  console.log('Headers:', JSON.stringify(event.headers, null, 2));
  console.log('Origin:', event.headers.origin || event.headers.Origin);

  // Handle OPTIONS (preflight) request
  if (event.httpMethod === 'OPTIONS') {
    console.log('🎯 Handling OPTIONS preflight request');

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'Content-Type,Authorization,X-Requested-With',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Max-Age': '86400',
      'Content-Type': 'application/json',
    };

    console.log('🔄 Returning CORS headers:', corsHeaders);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'CORS preflight OK',
        requestMethod: event.headers['access-control-request-method'],
        requestHeaders: event.headers['access-control-request-headers'],
        origin: event.headers.origin || event.headers.Origin,
        timestamp: new Date().toISOString(),
      }),
    };
  }

  // Handle actual request
  console.log('🎯 Handling actual request');

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'Content-Type,Authorization,X-Requested-With',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    },
    body: JSON.stringify({
      message: 'CORS Debug Endpoint Working',
      method: event.httpMethod,
      origin: event.headers.origin || event.headers.Origin,
      userAgent: event.headers['user-agent'],
      timestamp: new Date().toISOString(),
      debug: {
        corsConfigured: true,
        patchAllowed: true,
        originsAllowed: ['*'],
      },
    }),
  };
};
