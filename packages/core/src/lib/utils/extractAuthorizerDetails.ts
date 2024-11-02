import { APIGatewayProxyEvent } from 'aws-lambda';

interface LambdaAuthorizer {
  branchId: string;
  clinicId: string;
  userId: string;
  username: string;
  role: string;
}

export const extractAuthorizerDetails = (
  event: APIGatewayProxyEvent,
): LambdaAuthorizer => {
  try {
    const authorizer = event.requestContext.authorizer as {
      lambda: LambdaAuthorizer;
    };
    const { branchId, clinicId, userId, username, role } = authorizer.lambda;
    return { branchId, clinicId, userId, username, role };
  } catch (error) {
    console.error('Error extracting authorizer details:', error);
    throw new Error('Error extracting authorizer details');
  }
};
