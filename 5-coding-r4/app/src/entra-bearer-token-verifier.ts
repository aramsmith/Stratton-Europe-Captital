import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AuthenticatedPrincipal } from "./types.js";

export interface BearerTokenVerifier {
  verify(token: string): Promise<AuthenticatedPrincipal>;
}

export interface EntraBearerTokenVerifierConfig {
  readonly tenantId: string;
  readonly audience: string;
  readonly jwksUrl?: URL;
}

export function createEntraBearerTokenVerifier(
  config: EntraBearerTokenVerifierConfig
): BearerTokenVerifier {
  const issuer = `https://login.microsoftonline.com/${config.tenantId}/v2.0`;
  const jwks = createRemoteJWKSet(
    config.jwksUrl ??
      new URL(`https://login.microsoftonline.com/${config.tenantId}/discovery/v2.0/keys`)
  );

  return {
    verify: async (token) => {
      const { payload } = await jwtVerify(token, jwks, {
        algorithms: ["RS256"],
        audience: config.audience,
        issuer
      });
      const tenantId = typeof payload.tid === "string" ? payload.tid : "";
      const subjectId =
        typeof payload.oid === "string"
          ? payload.oid
          : typeof payload.sub === "string"
            ? payload.sub
            : "";
      const applicationId =
        typeof payload.azp === "string"
          ? payload.azp
          : typeof payload.appid === "string"
            ? payload.appid
            : "";
      if (
        tenantId.toLowerCase() !== config.tenantId.toLowerCase() ||
        !subjectId ||
        !applicationId
      ) {
        throw new Error("INVALID_ENTRA_APPLICATION_TOKEN");
      }
      const roles = Array.isArray(payload.roles)
        ? payload.roles.filter((role): role is string => typeof role === "string")
        : [];
      const isHuman = typeof payload.scp === "string" && payload.scp.trim().length > 0;
      return {
        tenantId,
        subjectId,
        roles,
        identityProvider: issuer,
        authType: "aad",
        isHuman,
        applicationId
      };
    }
  };
}
