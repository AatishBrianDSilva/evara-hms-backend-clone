import {
  decodeToken,
  verifyToken,
} from "@evara-backend/core/src/lib/utils/auth";
import { EUserRole } from "@evara-backend/core/src/models/User";
import {
  APIGatewayTokenAuthorizerEvent,
  APIGatewayAuthorizerResult,
} from "aws-lambda";

export const main = async (
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  const token = event.authorizationToken.replace("Bearer ", "");

  console.log("Method ARN", event.methodArn);

  try {
    const verified = await verifyToken(token);
    if (!verified) {
      throw new Error("Verification failed");
    }

    const decoded = decodeToken(token);
    if (!decoded || !decoded.role) {
      throw new Error("Invalid token or missing role information");
    }

    const principalId = decoded.sub;
    const role = decoded.role;

    // Use the role to determine the effect
    const effect = getPolicyEffect(role, event.methodArn);
    console.log("Authorization effect:", effect);
    return generatePolicy(principalId, effect, event.methodArn, {
      branchId: decoded.branchId,
      clinicId: decoded.clinicId,
      username: decoded.username,
      role: decoded.role,
    });
  } catch (error) {
    console.error("Authorization failed:", error);
    return generatePolicy("user", "Deny", event.methodArn);
  }
};

function generatePolicy(
  principalId: string,
  effect: string,
  resource: string,
  data?: Record<string, string>
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: resource,
        },
      ],
    },
    context: {
      userId: principalId,
      branchId: data?.branchId || "",
      clinicId: data?.clinicId || "",
      username: data?.username || "",
      role: data?.role || "",
    },
  };
}

function getPolicyEffect(role: EUserRole, resource: string): string {
  // Extract the permissions for the role and resource
  const rolePermissions = extractRolePermissions(role, resource);

  if (rolePermissions.includes("allow")) {
    return "Allow";
  }
  return "Deny";
}

function extractRolePermissions(role: EUserRole, methodArn: string): string[] {
  const { httpMethod, resourcePath } = parseMethodArn(methodArn);

  console.log({
    resourcePath,
    httpMethod,
    role,
  });

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
      ],
      PUT: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.Reception,
      ],
      DELETE: [EUserRole.Admin],
    },
    appointments: {
      GET: allRoles,
      POST: [
        EUserRole.Admin,
        EUserRole.Reception,
        EUserRole.Doctor,
        EUserRole.Nurse,
      ],
      PUT: [
        EUserRole.Admin,
        EUserRole.Reception,
        EUserRole.Doctor,
        EUserRole.Nurse,
      ],
      PATCH: [
        EUserRole.Admin,
        EUserRole.Reception,
        EUserRole.Doctor,
        EUserRole.Nurse,
      ],
      DELETE: [
        EUserRole.Admin,
        EUserRole.Reception,
        EUserRole.Doctor,
        EUserRole.Nurse,
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
      ],
      POST: allRoles,
      PUT: [EUserRole.Admin, EUserRole.Doctor, EUserRole.Nurse],
      DELETE: [EUserRole.Admin],
    },
    services: {
      GET: allRoles,
      POST: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.Reception,
        EUserRole.Billing,
      ],
      PUT: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.Reception,
        EUserRole.Billing,
      ],
      DELETE: [EUserRole.Admin],
    },
    procedures: {
      GET: [
        EUserRole.Admin,
        EUserRole.Billing,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.Billing,
        EUserRole.PharmacyManager,
      ],
      POST: [EUserRole.Admin, EUserRole.Doctor, EUserRole.Nurse],
      PUT: [EUserRole.Admin, EUserRole.Doctor, EUserRole.Nurse],
      DELETE: [EUserRole.Admin],
    },
    "cryo-preservations": {
      GET: [
        EUserRole.Admin,
        EUserRole.Billing,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.Billing,
        EUserRole.PharmacyManager,
      ],
      POST: [EUserRole.Admin, EUserRole.Doctor, EUserRole.Nurse],
      PUT: [EUserRole.Admin, EUserRole.Doctor, EUserRole.Nurse],
      DELETE: [EUserRole.Admin],
    },
    "treatment-cycles": {
      GET: [
        EUserRole.Admin,
        EUserRole.Billing,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.Billing,
        EUserRole.PharmacyManager,
      ],
      POST: [EUserRole.Admin, EUserRole.Doctor, EUserRole.Nurse],
      PUT: [EUserRole.Admin, EUserRole.Doctor, EUserRole.Nurse],
      PATCH: [EUserRole.Admin, EUserRole.Doctor, EUserRole.Nurse],
      DELETE: [EUserRole.Admin],
    },
    history: {
      GET: allRoles,
      POST: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.Reception,
      ],
      PUT: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.Reception,
      ],
      DELETE: [EUserRole.Admin],
    },
    billings: {
      GET: allRoles,
      POST: [EUserRole.Admin, EUserRole.Billing, EUserRole.Billing],
      PUT: [EUserRole.Admin, EUserRole.Billing, EUserRole.Billing],
      DELETE: [EUserRole.Admin],
    },
    pharmacy: {
      GET: allRoles,
      POST: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.Billing,
        EUserRole.PharmacyManager,
      ],
      PUT: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.Billing,
        EUserRole.PharmacyManager,
      ],
      DELETE: [EUserRole.Admin],
    },
    notes: {
      GET: allRoles,
      POST: [EUserRole.Admin, EUserRole.Doctor, EUserRole.Nurse],
      PUT: [EUserRole.Admin, EUserRole.Doctor, EUserRole.Nurse],
      DELETE: [EUserRole.Admin],
    },
    reports: {
      GET: allRoles,
      POST: [EUserRole.Admin, EUserRole.Doctor, EUserRole.Nurse],
      PUT: [EUserRole.Admin, EUserRole.Doctor, EUserRole.Nurse],
      DELETE: [EUserRole.Admin],
    },
    home: {
      GET: allRoles,
      POST: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.Reception,
      ],
      PUT: [
        EUserRole.Admin,
        EUserRole.Doctor,
        EUserRole.Nurse,
        EUserRole.Reception,
      ],
      DELETE: [EUserRole.Admin],
    },
    files: {
      GET: allRoles,
      POST: allRoles,
      PUT: allRoles,
      DELETE: [EUserRole.Admin],
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
      ],
      POST: [EUserRole.Admin],
      PATCH: [EUserRole.Admin],
      PUT: [EUserRole.Admin],
      DELETE: [EUserRole.Admin],
    },
    // PharmacyAPIStack
    "pharmacy-dashboard": {
      GET: allRoles,
      POST: [EUserRole.Admin, EUserRole.Billing, EUserRole.PharmacyManager],
      PUT: [EUserRole.Admin, EUserRole.Billing, EUserRole.PharmacyManager],
      PATCH: [EUserRole.Admin, EUserRole.Billing, EUserRole.PharmacyManager],
      DELETE: [EUserRole.Admin, EUserRole.Billing, EUserRole.PharmacyManager],
    },
  };

  const baseResource = resourcePath.split("/")[0];
  console.log("Base resource", baseResource);

  const allowedRoles = permissions[baseResource]?.[httpMethod] || [
    EUserRole.Admin,
  ];
  console.log("Allowed roles", allowedRoles);

  return allowedRoles.includes(role) ? ["allow"] : ["deny"];
}

function parseMethodArn(methodArn: string) {
  const parts = methodArn.split(":");
  const apiGatewayArnPart = parts[5];
  const apiDetails = apiGatewayArnPart.split("/");

  return {
    httpMethod: apiDetails[2],
    resourcePath: apiDetails.slice(3).join("/"), // Joins all remaining parts which could be multi-level paths
  };
}
