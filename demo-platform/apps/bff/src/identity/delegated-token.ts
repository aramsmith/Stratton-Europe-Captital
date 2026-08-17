import type { Request } from "express";
import { DemoHttpError } from "../errors.js";

export interface DelegatedUserToken {
  readonly accessToken: string;
  readonly tenantId: string;
  readonly actorId: string;
  readonly scopes: readonly string[];
  readonly roles: readonly string[];
}

export interface VerifiedAccessTokenClaims {
  readonly tid?: string;
  readonly oid?: string;
  readonly sub?: string;
  readonly aud?: string | readonly string[];
  readonly azp?: string;
  readonly scp?: string;
  readonly roles?: readonly string[];
  readonly exp?: number;
  readonly idtyp?: string;
}

export interface DelegatedAccessTokenVerifier {
  verify(accessToken: string): Promise<VerifiedAccessTokenClaims>;
}

export interface DelegatedTokenPolicy {
  readonly expectedTenantId: string;
  readonly expectedAudience: string;
  readonly requiredScope: string;
  readonly expectedClientApplicationId: string;
  readonly now?: () => number;
}

export async function resolveDelegatedUserToken(
  request: Pick<Request, "header" | "rawHeaders">,
  policy: DelegatedTokenPolicy,
  verifier: DelegatedAccessTokenVerifier
): Promise<DelegatedUserToken> {
  const accessToken = readSingleBearerAccessToken(request);
  if (!accessToken) {
    throw new DemoHttpError(401, "UNAUTHENTICATED");
  }

  let claims: VerifiedAccessTokenClaims;
  try {
    claims = await verifier.verify(accessToken);
  } catch {
    throw new DemoHttpError(401, "UNAUTHENTICATED");
  }

  const tenantId = requiredClaim(claims.tid);
  if (tenantId !== policy.expectedTenantId) {
    throw new DemoHttpError(403, "POLICY_DENIED", "TOKEN_TENANT_NOT_AUTHORISED");
  }
  if (!isExpectedAudience(claims.aud, policy.expectedAudience)) {
    throw new DemoHttpError(401, "UNAUTHENTICATED", "TOKEN_AUDIENCE_INVALID");
  }
  if (
    !Number.isFinite(claims.exp) ||
    (claims.exp as number) * 1_000 <= (policy.now ?? Date.now)()
  ) {
    throw new DemoHttpError(401, "UNAUTHENTICATED", "TOKEN_EXPIRED");
  }
  if (claims.idtyp !== undefined && claims.idtyp !== "user") {
    throw new DemoHttpError(401, "UNAUTHENTICATED", "DELEGATED_TOKEN_REQUIRED");
  }
  const clientApplicationId = requiredClaim(claims.azp);
  if (clientApplicationId !== policy.expectedClientApplicationId) {
    throw new DemoHttpError(403, "POLICY_DENIED", "TOKEN_CLIENT_APPLICATION_NOT_AUTHORISED");
  }

  const scopes = parseScopes(claims.scp);
  if (scopes.length === 0) {
    throw new DemoHttpError(401, "UNAUTHENTICATED", "DELEGATED_TOKEN_REQUIRED");
  }
  if (!scopes.includes(policy.requiredScope)) {
    throw new DemoHttpError(403, "POLICY_DENIED", "DELEGATED_SCOPE_REQUIRED");
  }

  const actorId = requiredClaim(claims.oid ?? claims.sub);
  return {
    accessToken,
    tenantId,
    actorId,
    scopes,
    roles: parseRoles(claims.roles)
  };
}

function readSingleBearerAccessToken(
  request: Pick<Request, "header" | "rawHeaders">
): string | undefined {
  const directAccessToken = readDirectBearerAccessToken(request);
  const forwardedValues = readRawHeaderValues(
    request.rawHeaders,
    "x-stratton-delegated-token"
  );
  if (forwardedValues.length > 1) {
    return undefined;
  }

  const forwardedAccessToken = forwardedValues[0]?.trim() || undefined;
  if (
    directAccessToken &&
    forwardedAccessToken &&
    directAccessToken !== forwardedAccessToken
  ) {
    return undefined;
  }

  return directAccessToken ?? forwardedAccessToken;
}

function readDirectBearerAccessToken(
  request: Pick<Request, "header" | "rawHeaders">
): string | undefined {
  const authorizationValues = readRawHeaderValues(request.rawHeaders, "authorization");
  if (authorizationValues.length > 1) {
    return undefined;
  }

  const authorization = authorizationValues[0];
  return authorization
    ? /^Bearer ([A-Za-z0-9\-._~+/]+=*)$/iu.exec(authorization)?.[1]
    : undefined;
}

function readRawHeaderValues(rawHeaders: readonly string[], name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < rawHeaders.length; index += 2) {
    if (rawHeaders[index]?.toLowerCase() === name) {
      values.push(rawHeaders[index + 1] ?? "");
    }
  }
  return values;
}

function requiredClaim(value: string | undefined): string {
  const claim = value?.trim();
  if (!claim) {
    throw new DemoHttpError(401, "UNAUTHENTICATED");
  }
  return claim;
}

function isExpectedAudience(
  audience: string | readonly string[] | undefined,
  expectedAudience: string
): boolean {
  return typeof audience === "string"
    ? audience === expectedAudience
    : Array.isArray(audience) && audience.includes(expectedAudience);
}

function parseScopes(scopeClaim: string | undefined): string[] {
  return [...new Set((scopeClaim ?? "").split(/\s+/u).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function parseRoles(roles: readonly string[] | undefined): string[] {
  return [...new Set((roles ?? []).map((role) => role.trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right)
  );
}
