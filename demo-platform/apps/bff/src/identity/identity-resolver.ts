import type { Request } from "express";
import { DemoHttpError } from "../errors.js";
import {
  demoApplicationRoles,
  resolveContainerAppsIdentity,
  type TrustedIdentity
} from "./trusted-identity.js";

const deprecatedAuthorityHeaders = [
  "x-demo-principal-type",
  "x-demo-actor",
  "x-demo-actor-id"
] as const;

export interface IdentityResolver {
  resolve(request: Request): Promise<TrustedIdentity>;
}

export function createLocalIdentityResolver(
  identity: TrustedIdentity = {
    actorId: "local-demo-human",
    tenantId: "local-stratton-demo",
    principalType: "HUMAN",
    roles: [...demoApplicationRoles]
  }
): IdentityResolver {
  return {
    async resolve(request) {
      rejectDeprecatedAuthorityHeaders(request);
      return identity;
    }
  };
}

export function createContainerAppsIdentityResolver(options: {
  readonly expectedTenantId: string;
  readonly trustedProxyPrincipalId: string;
}): IdentityResolver {
  return {
    async resolve(request) {
      rejectDeprecatedAuthorityHeaders(request);
      const clientPrincipal = request.header("x-ms-client-principal");
      const forwardedPrincipal = request.header("x-stratton-forwarded-principal");
      return resolveContainerAppsIdentity(
        {
          ...(clientPrincipal ? { clientPrincipal } : {}),
          ...(forwardedPrincipal ? { forwardedPrincipal } : {})
        },
        options
      );
    }
  };
}

function rejectDeprecatedAuthorityHeaders(request: Request): void {
  const suppliedHeader = deprecatedAuthorityHeaders.find((header) => request.header(header));
  if (suppliedHeader) {
    throw new DemoHttpError(400, "INVALID_CONTRACT", "CLIENT_AUTHORITY_HEADERS_NOT_ALLOWED");
  }
}
