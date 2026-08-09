import { describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import {
  resolveDelegatedUserToken,
  type DelegatedTokenPolicy,
  type VerifiedAccessTokenClaims
} from "./delegated-token.js";

const policy: DelegatedTokenPolicy = {
  expectedTenantId: "tenant-stratton",
  expectedAudience: "api://stratton-demo-bff",
  requiredScope: "access_as_user"
};

function requestWithAccessToken(accessToken?: string): Request {
  return {
    header: (name: string) =>
      name.toLowerCase() === "x-ms-token-aad-access-token" ? accessToken : undefined
  } as Request;
}

function verifiedClaims(
  overrides: Partial<VerifiedAccessTokenClaims> = {}
): VerifiedAccessTokenClaims {
  return {
    tid: "tenant-stratton",
    oid: "human-object-id",
    aud: "api://stratton-demo-bff",
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
    ["wrong audience", verifiedClaims({ aud: "api://other-api" }), 401, "UNAUTHENTICATED"],
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
