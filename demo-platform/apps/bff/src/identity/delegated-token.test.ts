import { describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import {
  resolveDelegatedUserToken,
  type DelegatedTokenPolicy,
  type VerifiedAccessTokenClaims
} from "./delegated-token.js";

const policy: DelegatedTokenPolicy = {
  expectedTenantId: "tenant-stratton",
  expectedAudience: "44444444-4444-4444-4444-444444444444",
  requiredScope: "access_as_user",
  expectedClientApplicationId: "33333333-3333-3333-3333-333333333333"
};

function requestWithAccessToken(accessToken?: string, duplicate = false): Request {
  const authorization = accessToken ? `Bearer ${accessToken}` : undefined;
  return {
    header: (name: string) =>
      name.toLowerCase() === "authorization" ? authorization : undefined,
    rawHeaders: duplicate
      ? ["Authorization", authorization ?? "", "Authorization", "Bearer duplicate.token"]
      : authorization
        ? ["Authorization", authorization]
        : []
  } as Request;
}

function requestWithForwardedAccessToken(
  forwardedAccessToken: string,
  directAccessToken?: string
): Request {
  const authorization = directAccessToken ? `Bearer ${directAccessToken}` : undefined;
  return {
    header: (name: string) => {
      if (name.toLowerCase() === "authorization") {
        return authorization;
      }
      return name.toLowerCase() === "x-stratton-delegated-token"
        ? forwardedAccessToken
        : undefined;
    },
    rawHeaders: [
      ...(authorization ? ["Authorization", authorization] : []),
      "X-Stratton-Delegated-Token",
      forwardedAccessToken
    ]
  } as Request;
}

function verifiedClaims(
  overrides: Partial<VerifiedAccessTokenClaims> = {}
): VerifiedAccessTokenClaims {
  return {
    tid: "tenant-stratton",
    oid: "human-object-id",
    aud: "44444444-4444-4444-4444-444444444444",
    azp: "33333333-3333-3333-3333-333333333333",
    scp: "access_as_user profile",
    roles: ["DealContributor", "CaseReader"],
    exp: 1_900_000_000,
    ...overrides
  };
}

function verifier(claims = verifiedClaims()) {
  return {
    verify: vi.fn().mockResolvedValue(claims)
  };
}

describe("resolveDelegatedUserToken", () => {
  it("rejects a request without a delegated access token", async () => {
    await expect(
      resolveDelegatedUserToken(requestWithAccessToken(), policy, verifier())
    ).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED"
    });
  });

  it.each([
    ["wrong tenant", verifiedClaims({ tid: "other-tenant" }), 403, "POLICY_DENIED"],
    ["wrong audience", verifiedClaims({ aud: "99999999-9999-9999-9999-999999999999" }), 401, "UNAUTHENTICATED"],
    ["wrong client application", verifiedClaims({ azp: "other-web-client" }), 403, "POLICY_DENIED"],
    ["missing client application", verifiedClaims({ azp: undefined }), 401, "UNAUTHENTICATED"],
    ["expired token", verifiedClaims({ exp: 1 }), 401, "UNAUTHENTICATED"],
    ["application token", verifiedClaims({ idtyp: "app", scp: undefined }), 401, "UNAUTHENTICATED"],
    ["missing delegated scope", verifiedClaims({ scp: "profile" }), 403, "POLICY_DENIED"]
  ])("rejects a %s", async (_name, claims, status, code) => {
    await expect(
      resolveDelegatedUserToken(requestWithAccessToken("signed-user-jwt"), policy, verifier(claims))
    ).rejects.toMatchObject({ status, code });
  });

  it("rejects a malformed JWT when the verifier rejects its signature or structure", async () => {
    const tokenVerifier = {
      verify: vi.fn().mockRejectedValue(new Error("malformed JWT"))
    };

    await expect(
      resolveDelegatedUserToken(requestWithAccessToken("not.a.jwt"), policy, tokenVerifier)
    ).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED"
    });
    expect(tokenVerifier.verify).toHaveBeenCalledWith("not.a.jwt");
  });

  it("rejects duplicate Authorization header lines", async () => {
    await expect(
      resolveDelegatedUserToken(
        requestWithAccessToken("signed-user-jwt", true),
        policy,
        verifier()
      )
    ).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED"
    });
  });

  it("accepts the verified delegated token forwarded through Container Apps Easy Auth", async () => {
    const tokenVerifier = verifier();

    await expect(
      resolveDelegatedUserToken(
        requestWithForwardedAccessToken("signed-user-jwt"),
        policy,
        tokenVerifier
      )
    ).resolves.toMatchObject({
      accessToken: "signed-user-jwt",
      actorId: "human-object-id"
    });
    expect(tokenVerifier.verify).toHaveBeenCalledWith("signed-user-jwt");
  });

  it("rejects mismatched direct and forwarded delegated tokens", async () => {
    await expect(
      resolveDelegatedUserToken(
        requestWithForwardedAccessToken("different-forwarded-jwt", "direct-jwt"),
        policy,
        verifier()
      )
    ).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED"
    });
  });

  it("returns verified delegated claims without decoding an unverified token", async () => {
    const tokenVerifier = verifier();

    await expect(
      resolveDelegatedUserToken(requestWithAccessToken("signed-user-jwt"), policy, tokenVerifier)
    ).resolves.toEqual({
      accessToken: "signed-user-jwt",
      tenantId: "tenant-stratton",
      actorId: "human-object-id",
      scopes: ["access_as_user", "profile"],
      roles: ["CaseReader", "DealContributor"]
    });
  });
});
