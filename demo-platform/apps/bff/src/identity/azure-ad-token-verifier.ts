import { createRemoteJWKSet, jwtVerify } from "jose";
import type {
  DelegatedAccessTokenVerifier,
  VerifiedAccessTokenClaims
} from "./delegated-token.js";

export function createAzureAdTokenVerifier(options: {
  readonly tenantId: string;
  readonly audience: string;
}): DelegatedAccessTokenVerifier {
  const issuer = `https://login.microsoftonline.com/${encodeURIComponent(options.tenantId)}/v2.0`;
  const keySet = createRemoteJWKSet(
    new URL(
      `https://login.microsoftonline.com/${encodeURIComponent(options.tenantId)}/discovery/v2.0/keys`
    )
  );

  return {
    async verify(accessToken): Promise<VerifiedAccessTokenClaims> {
      const { payload } = await jwtVerify(accessToken, keySet, {
        issuer,
        audience: options.audience
      });
      return {
        ...(typeof payload.tid === "string" ? { tid: payload.tid } : {}),
        ...(typeof payload.oid === "string" ? { oid: payload.oid } : {}),
        ...(typeof payload.sub === "string" ? { sub: payload.sub } : {}),
        ...(typeof payload.aud === "string" || Array.isArray(payload.aud)
          ? { aud: payload.aud }
          : {}),
        ...(typeof payload.scp === "string" ? { scp: payload.scp } : {}),
        ...(Array.isArray(payload.roles) && payload.roles.every((role) => typeof role === "string")
          ? { roles: payload.roles }
          : {}),
        ...(typeof payload.exp === "number" ? { exp: payload.exp } : {}),
        ...(typeof payload.idtyp === "string" ? { idtyp: payload.idtyp } : {})
      };
    }
  };
}
