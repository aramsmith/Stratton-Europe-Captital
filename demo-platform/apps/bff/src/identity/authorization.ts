import { DemoHttpError } from "../errors.js";
import type {
  DemoApplicationRole,
  TrustedIdentity
} from "./trusted-identity.js";

export interface AuthorizationPolicy {
  readonly expectedTenantId: string;
  readonly caseId: "project-danube";
  readonly caseAccessRole: DemoApplicationRole;
  readonly purposeRole: DemoApplicationRole;
}

export function assertAuthorized(
  identity: TrustedIdentity,
  policy: AuthorizationPolicy,
  caseId: string,
  operationRole?: DemoApplicationRole
): void {
  if (identity.tenantId !== policy.expectedTenantId) {
    throw new DemoHttpError(403, "POLICY_DENIED", "TENANT_NOT_AUTHORISED");
  }
  if (caseId !== policy.caseId) {
    throw new DemoHttpError(403, "POLICY_DENIED", "CASE_NOT_AUTHORISED");
  }

  const requiredRoles = [
    policy.caseAccessRole,
    policy.purposeRole,
    ...(operationRole ? [operationRole] : [])
  ];
  const missingRole = requiredRoles.find((role) => !identity.roles.includes(role));
  if (missingRole) {
    throw new DemoHttpError(403, "POLICY_DENIED", `APPLICATION_ROLE_REQUIRED:${missingRole}`);
  }
}
