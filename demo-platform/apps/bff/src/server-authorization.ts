import type { Response } from "express";
import {
  assertAuthorized,
  type AuthorizationPolicy
} from "./identity/authorization.js";
import type {
  DemoApplicationRole,
  TrustedIdentity
} from "./identity/trusted-identity.js";
import { DemoHttpError } from "./errors.js";

export interface RequestAuthorizer {
  require(
    response: Response,
    caseId: string,
    operationRole?: DemoApplicationRole
  ): TrustedIdentity;
}

export function createRequestAuthorizer(policy: AuthorizationPolicy): RequestAuthorizer {
  return {
    require(response, caseId, operationRole) {
      const identity = response.locals.trustedIdentity;
      if (!isTrustedIdentity(identity)) {
        throw new DemoHttpError(401, "UNAUTHENTICATED");
      }
      assertAuthorized(identity, policy, caseId, operationRole);
      return identity;
    }
  };
}

function isTrustedIdentity(value: unknown): value is TrustedIdentity {
  return (
    typeof value === "object" &&
    value !== null &&
    "actorId" in value &&
    typeof value.actorId === "string" &&
    "tenantId" in value &&
    typeof value.tenantId === "string" &&
    "principalType" in value &&
    value.principalType === "HUMAN" &&
    "roles" in value &&
    Array.isArray(value.roles)
  );
}
