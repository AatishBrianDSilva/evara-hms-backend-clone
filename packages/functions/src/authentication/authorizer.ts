import {
  decodeToken,
  verifyToken,
} from '@evara-backend/core/src/lib/utils/auth';
import { EUserRole } from '@evara-backend/core/src/models/User';
import {
  APIGatewayTokenAuthorizerEvent,
  APIGatewayAuthorizerResult,
} from 'aws-lambda';

export const main = async (
  event: APIGatewayTokenAuthorizerEvent,
): Promise<APIGatewayAuthorizerResult> => {
  const token = event.authorizationToken.replace('Bearer ', '');

  // console.log("Method ARN", event.methodArn);

  try {
    const verified = await verifyToken(token);
    if (!verified) {
      throw new Error('Verification failed');
    }

    const decoded = decodeToken(token);
    if (!decoded || !decoded.role) {
      throw new Error('Invalid token or missing role information');
    }

    const principalId = decoded.sub;
    const role = decoded.role;

    // Use the role to determine the effect
    const effect = getPolicyEffect(role, event.methodArn);
    // console.log("Authorization effect:", effect);
    return generatePolicy(principalId, effect, event.methodArn, {
      branchId: decoded.branchId,
      clinicId: decoded.clinicId,
      username: decoded.username,
      role: decoded.role,
    });
  } catch (error) {
    console.log('Roles');
    console.error('Authorization failed:', error);
    return generatePolicy('user', 'Deny', event.methodArn);
  }
};

function generatePolicy(
  principalId: string,
  effect: string,
  resource: string,
  data?: Record<string, string>,
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect as any,
          Resource: resource,
        },
      ],
    },
    context: {
      userId: principalId,
      branchId: data?.branchId || '',
      clinicId: data?.clinicId || '',
      username: data?.username || '',
      role: data?.role || '',
    },
  };
}

function getPolicyEffect(role: EUserRole, resource: string): string {
  // Extract the permissions for the role and resource
  const rolePermissions = extractRolePermissions(role, resource);

  if (rolePermissions.includes('allow')) {
    return 'Allow';
  }
  return 'Deny';
}

function extractRolePermissions(role: EUserRole, methodArn: string): string[] {
  const { httpMethod, resourcePath } = parseMethodArn(methodArn);

  // console.log({
  //   resourcePath,
  //   httpMethod,
  //   role,
  // });

  const allRoles: EUserRole[] = Object.values(EUserRole);

  // Define permissions for roles
  const permissions: Record<string, Record<string, EUserRole[]>> = {
    // MainStack
    patients: {
      GET: allRoles,
      POST: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.Reception,
        EUserRole.Embryologist,
        EUserRole.CenterManager,
      ],
      PUT: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.Reception,
        EUserRole.CenterManager,
        EUserRole.Embryologist,
      ],
      DELETE: [EUserRole.Admin, EUserRole.CenterManager],
    },
    appointments: {
      GET: allRoles,
      POST: [
        EUserRole.Admin,
        EUserRole.Reception,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.CenterManager,
      ],
      PUT: [
        EUserRole.Admin,
        EUserRole.Reception,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.CenterManager,
      ],
      PATCH: [
        EUserRole.Admin,
        EUserRole.Reception,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.CenterManager,
      ],
      DELETE: [
        EUserRole.Admin,
        EUserRole.Reception,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.CenterManager,
      ],
    },
    investigations: {
      GET: [
        EUserRole.Admin,
        EUserRole.Billing,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.Billing,
        EUserRole.PharmacyManager,
        EUserRole.CenterManager,
        EUserRole.Embryologist,
      ],
      POST: allRoles,
      PUT: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.CenterManager,
        EUserRole.Embryologist,
      ],
      DELETE: [EUserRole.Admin, EUserRole.CenterManager],
    },
    services: {
      GET: allRoles,
      POST: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.Reception,
        EUserRole.Billing,

        EUserRole.CenterManager,
      ],
      PUT: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.Reception,
        EUserRole.Billing,
        EUserRole.CenterManager,
      ],
      DELETE: [EUserRole.Admin, EUserRole.CenterManager],
    },
    procedures: {
      GET: [
        EUserRole.Admin,
        EUserRole.Billing,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.Billing,
        EUserRole.PharmacyManager,
        EUserRole.Embryologist,

        EUserRole.CenterManager,
      ],
      POST: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.CenterManager,
        EUserRole.Embryologist,
      ],
      PUT: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.CenterManager,
        EUserRole.Embryologist,
      ],
      DELETE: [EUserRole.Admin, EUserRole.CenterManager],
    },
    'cryo-preservations': {
      GET: [
        EUserRole.Admin,
        EUserRole.Billing,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.Billing,
        EUserRole.PharmacyManager,
        EUserRole.CenterManager,
        EUserRole.Embryologist,
      ],
      POST: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.CenterManager,
        EUserRole.Embryologist,
      ],
      PUT: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.CenterManager,
        EUserRole.Embryologist,
      ],
      DELETE: [EUserRole.Admin, EUserRole.CenterManager],
    },
    'treatment-cycles': {
      GET: [
        EUserRole.Admin,
        EUserRole.Billing,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.Billing,
        EUserRole.PharmacyManager,
        EUserRole.CenterManager,
        EUserRole.Embryologist,
      ],
      POST: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.CenterManager,
        EUserRole.Embryologist,
      ],
      PUT: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.CenterManager,
        EUserRole.Embryologist,
      ],
      PATCH: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.CenterManager,
        EUserRole.Embryologist,
      ],
      DELETE: [EUserRole.Admin, EUserRole.CenterManager],
    },
    history: {
      GET: allRoles,
      POST: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.Reception,
        EUserRole.CenterManager,
      ],
      PUT: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.Reception,
        EUserRole.CenterManager,
      ],
      DELETE: [EUserRole.Admin, EUserRole.CenterManager],
    },
    billings: {
      GET: allRoles,
      POST: [EUserRole.Admin, EUserRole.Billing, EUserRole.CenterManager],
      PUT: [EUserRole.Admin, EUserRole.Billing, EUserRole.CenterManager],
      DELETE: [EUserRole.Admin, EUserRole.CenterManager],
    },
    pharmacy: {
      GET: allRoles,
      POST: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.Billing,
        EUserRole.PharmacyManager,
        EUserRole.CenterManager,
      ],
      PUT: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.Billing,
        EUserRole.PharmacyManager,
        EUserRole.CenterManager,
      ],
      DELETE: [EUserRole.Admin, EUserRole.CenterManager],
    },
    notes: {
      GET: allRoles,
      POST: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.CenterManager,
        EUserRole.Embryologist,
      ],
      PUT: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.CenterManager,
        EUserRole.Embryologist,
      ],
      DELETE: [EUserRole.Admin, EUserRole.CenterManager],
    },
    reports: {
      GET: allRoles,
      POST: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.CenterManager,
      ],
      PUT: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.CenterManager,
      ],
      DELETE: [EUserRole.Admin, EUserRole.CenterManager],
    },
    home: {
      GET: allRoles,
      POST: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.Reception,
        EUserRole.CenterManager,
      ],
      PUT: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.Reception,
        EUserRole.CenterManager,
      ],
      DELETE: [EUserRole.Admin, EUserRole.CenterManager],
    },
    files: {
      GET: allRoles,
      POST: allRoles,
      PUT: allRoles,
      DELETE: [EUserRole.Admin, EUserRole.CenterManager],
    },
    // MasterAPILocalStack & MasterAPIStack
    master: {
      GET: [
        EUserRole.Admin,
        EUserRole.Billing,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.Billing,
        EUserRole.PharmacyManager,
        EUserRole.Reception,
        EUserRole.CenterManager,
      ],
      POST: [EUserRole.Admin, EUserRole.CenterManager],
      PATCH: [EUserRole.Admin, EUserRole.CenterManager],
      PUT: [EUserRole.Admin, EUserRole.CenterManager],
      DELETE: [EUserRole.Admin, EUserRole.CenterManager],
    },
    // PharmacyAPIStack
    'pharmacy-dashboard': {
      GET: allRoles,
      POST: [
        EUserRole.Admin,
        EUserRole.Billing,
        EUserRole.PharmacyManager,
        EUserRole.CenterManager,
      ],
      PUT: [
        EUserRole.Admin,
        EUserRole.Billing,
        EUserRole.PharmacyManager,
        EUserRole.CenterManager,
      ],
      PATCH: [
        EUserRole.Admin,
        EUserRole.Billing,
        EUserRole.PharmacyManager,
        EUserRole.CenterManager,
      ],
      DELETE: [
        EUserRole.Admin,
        EUserRole.Billing,
        EUserRole.PharmacyManager,
        EUserRole.CenterManager,
      ],
    },
    analytics: {
      GET: [EUserRole.Admin, EUserRole.CenterManager],
    },
  };

  const baseResource = resourcePath.split('/')[0];
  // console.log("Base resource", baseResource);

  const allowedRoles = permissions[baseResource]?.[httpMethod] || [
    EUserRole.Admin,
  ];
  // console.log("Allowed roles", allowedRoles);

  return allowedRoles.includes(role) ? ['allow'] : ['deny'];
}

function parseMethodArn(methodArn: string) {
  const parts = methodArn.split(':');
  const apiGatewayArnPart = parts[5];
  const apiDetails = apiGatewayArnPart.split('/');

  return {
    httpMethod: apiDetails[2],
    resourcePath: apiDetails.slice(3).join('/'), // Joins all remaining parts which could be multi-level paths
  };
}
