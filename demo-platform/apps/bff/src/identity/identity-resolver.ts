import type { Request } from "express";
import { DemoHttpError } from "../errors.js";
import {
  resolveDelegatedUserToken,
  type DelegatedAccessTokenVerifier,
  type DelegatedTokenPolicy,
  type DelegatedUserToken
} from "./delegated-token.js";
import {
  demoApplicationRoles,
  resolveContainerAppsIdentity,
  type TrustedIdentity
} from "./trusted-identity.js";
import { createAzureAdTokenVerifier } from "./azure-ad-token-verifier.js";

const deprecatedAuthorityHeaders = [
  "x-demo-principal-type",
  "x-demo-actor",
  "x-demo-actor-id"
] as const;

export interface IdentityResolver {
  resolve(request: Request): Promise<TrustedIdentity>;
  resolveDelegatedToken(request: Pick<Request, "header">): Promise<DelegatedUserToken>;
}

export function createLocalIdentityResolver(
  identity: TrustedIdentity = {
    actorId: "local-demo-human",
    tenantId: "local-stratton-demo",
    principalType: "HUMAN",
    roles: [...demoApplicationRoles]
  }
): IdentityResolver {
  const delegatedToken: DelegatedUserToken = {
    accessToken: "local-delegated-token-fixture",
    tenantId: identity.tenantId,
    actorId: identity.actorId,
    scopes: ["access_as_user"],
    roles: [...identity.roles]
  };
  return {
    async resolve(request) {
      rejectDeprecatedAuthorityHeaders(request);
      return identity;
    },
    async resolveDelegatedToken(request) {
      rejectDeprecatedAuthorityHeaders(request);
      return delegatedToken;
    }
  };
}

export function createContainerAppsIdentityResolver(options: {
  readonly expectedTenantId: string;
  readonly trustedProxyPrincipalId: string;
  readonly delegatedTokenPolicy: DelegatedTokenPolicy;
  readonly delegatedTokenVerifier?: DelegatedAccessTokenVerifier;
}): IdentityResolver {
  const tokenVerifier =
    options.delegatedTokenVerifier ??
    createAzureAdTokenVerifier({
      tenantId: options.expectedTenantId,
      audience: options.delegatedTokenPolicy.expectedAudience
    });
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
    },
    async resolveDelegatedToken(request) {
      rejectDeprecatedAuthorityHeaders(request);
      return resolveDelegatedUserToken(request, options.delegatedTokenPolicy, tokenVerifier);
    }
  };
}

function rejectDeprecatedAuthorityHeaders(request: Pick<Request, "header">): void {
  const suppliedHeader = deprecatedAuthorityHeaders.find((header) => request.header(header));
  if (suppliedHeader) {
    throw new DemoHttpError(400, "INVALID_CONTRACT", "CLIENT_AUTHORITY_HEADERS_NOT_ALLOWED");
  }
}
