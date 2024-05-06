import {
  decodeToken,
  verifyToken,
} from "@evara-backend/core/src/lib/utils/auth";
import {
  APIGatewayTokenAuthorizerEvent,
  APIGatewayAuthorizerResult,
} from "aws-lambda";

type UserRole = "admin" | "user" | "guest" | "public";

export const main = async (
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  const token = event.authorizationToken.replace("Bearer ", "");

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
    const role = decoded.role || "public";

    // Use the role to determine the effect
    const effect = getPolicyEffect(role, event.methodArn);
    return generatePolicy(principalId, effect, event.methodArn, {
      branchId: decoded.branchId,
      clinicId: decoded.clinicId,
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
    },
  };
}

function getPolicyEffect(role: UserRole, resource: string): string {
  // Here, you would check the role against the required permissions for the resource
  // For simplicity, assuming role directly corresponds to allowed actions
  const rolePermissions = extractRolePermissions(role, resource);

  if (rolePermissions.includes("allow")) {
    return "Allow";
  }
  return "Deny";
}

function extractRolePermissions(role: UserRole, resource: string): string[] {
  const permissions: Record<UserRole, string[]> = {
    admin: ["allow"],
    user: resource.includes("read") ? ["allow"] : ["deny"],
    guest: ["deny"],
    public: ["allow"],
  };

  return permissions[role]; // Now TypeScript knows this indexing is safe
}
