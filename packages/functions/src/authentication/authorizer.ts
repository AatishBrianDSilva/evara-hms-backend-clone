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

function getPolicyEffect(role: UserRole, resource: string): string {
  // Here, you would check the role against the required permissions for the resource
  // For simplicity, assuming role directly corresponds to allowed actions
  const rolePermissions = extractRolePermissions(role, resource);

  if (rolePermissions.includes("allow")) {
    return "Allow";
  }
  return "Deny";
}

function extractRolePermissions(role: UserRole, methodArn: string): string[] {
  // const { httpMethod, resourcePath } = parseMethodArn(methodArn);

  // console.log({
  //   resourcePath,
  //   httpMethod,
  //   role,
  // });

  // const permissions: Record<string, Record<string, string[]>> = {
  //   patients: {
  //     GET: ["admin", "user"],
  //     POST: ["admin"],
  //   },
  // };

  // const allowedRoles = permissions[resourcePath]?.[httpMethod] || ["admin"];
  // console.log("Allowed roles", allowedRoles);

  // return allowedRoles.includes(role) ? ["allow"] : ["deny"];
  return ["allow"];
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
