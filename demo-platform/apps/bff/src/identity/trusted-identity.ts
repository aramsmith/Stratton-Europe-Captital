import { z } from "zod";
import { DemoHttpError } from "../errors.js";

const tenantClaimTypes = new Set([
  "tid",
  "http://schemas.microsoft.com/identity/claims/tenantid"
]);
const actorClaimTypes = new Set([
  "oid",
  "sub",
  "http://schemas.microsoft.com/identity/claims/objectidentifier",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
]);
const roleClaimTypes = new Set([
  "roles",
  "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
]);

const principalSchema = z
  .object({
    auth_typ: z.literal("aad"),
    claims: z.array(
      z
        .object({
          typ: z.string().min(1),
          val: z.string()
        })
        .strip()
    )
  })
  .strip();

export const demoApplicationRoles = [
  "Stratton.Demo.ProjectDanube.Access",
  "Stratton.Demo.EvidenceToDecision",
  "Stratton.Demo.Analyst",
  "Stratton.Demo.DealReviewer",
  "Stratton.Demo.LegalReviewer",
  "Stratton.Demo.ComplianceReviewer",
  "Stratton.Demo.CommitteePreparer",
  "Stratton.Demo.GovernanceOperator",
  "Stratton.Demo.ScenarioResetter"
] as const;

export type DemoApplicationRole = (typeof demoApplicationRoles)[number];
const demoApplicationRoleSet: ReadonlySet<string> = new Set(demoApplicationRoles);

export interface TrustedIdentity {
  readonly actorId: string;
  readonly tenantId: string;
  readonly principalType: "HUMAN";
  readonly roles: readonly DemoApplicationRole[];
}

export interface ContainerAppsIdentityHeaders {
  readonly clientPrincipal?: string;
}

interface ContainerAppsIdentityPolicy {
  readonly expectedTenantId: string;
}

export function resolveContainerAppsIdentity(
  headers: ContainerAppsIdentityHeaders,
  policy: ContainerAppsIdentityPolicy
): TrustedIdentity {
  const principal = parsePrincipal(headers.clientPrincipal);
  const tenantId = requireClaim(principal.claims, tenantClaimTypes, "PRINCIPAL_TENANT_REQUIRED");

  if (tenantId !== policy.expectedTenantId) {
    throw new DemoHttpError(403, "POLICY_DENIED", "TENANT_NOT_AUTHORISED");
  }

  const actorId = requireClaim(principal.claims, actorClaimTypes, "PRINCIPAL_ACTOR_REQUIRED");
  const roles = [...new Set(
    principal.claims
      .filter((claim) => roleClaimTypes.has(claim.typ))
      .map((claim) => claim.val)
      .filter(isDemoApplicationRole)
  )].sort((left, right) => left.localeCompare(right));

  return {
    actorId,
    tenantId,
    principalType: "HUMAN",
    roles
  };
}

function isDemoApplicationRole(role: string): role is DemoApplicationRole {
  return demoApplicationRoleSet.has(role);
}

function parsePrincipal(encodedPrincipal: string | undefined): z.infer<typeof principalSchema> {
  if (!encodedPrincipal) {
    throw new DemoHttpError(401, "UNAUTHENTICATED");
  }

  try {
    const decoded = Buffer.from(encodedPrincipal, "base64").toString("utf8");
    return principalSchema.parse(JSON.parse(decoded) as unknown);
  } catch (error) {
    if (error instanceof DemoHttpError) {
      throw error;
    }
    throw new DemoHttpError(401, "UNAUTHENTICATED");
  }
}

function requireClaim(
  claims: readonly { readonly typ: string; readonly val: string }[],
  acceptedTypes: ReadonlySet<string>,
  message: string
): string {
  const value = claims.find((claim) => acceptedTypes.has(claim.typ))?.val.trim();
  if (!value) {
    throw new DemoHttpError(401, "UNAUTHENTICATED", message);
  }
  return value;
}
