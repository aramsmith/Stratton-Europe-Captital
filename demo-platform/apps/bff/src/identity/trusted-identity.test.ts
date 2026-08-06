import { describe, expect, it } from "vitest";
import {
  resolveContainerAppsIdentity,
  type ContainerAppsIdentityHeaders
} from "./trusted-identity.js";

function encodePrincipal(input: {
  readonly tenantId: string;
  readonly actorId: string;
  readonly roles: readonly string[];
}): string {
  return Buffer.from(
    JSON.stringify({
      auth_typ: "aad",
      claims: [
        {
          typ: "http://schemas.microsoft.com/identity/claims/tenantid",
          val: input.tenantId
        },
        {
          typ: "http://schemas.microsoft.com/identity/claims/objectidentifier",
          val: input.actorId
        },
        ...input.roles.map((role) => ({
          typ: "roles",
          val: role
        }))
      ]
    }),
    "utf8"
  ).toString("base64");
}

describe("resolveContainerAppsIdentity", () => {
  it("accepts forwarded human claims only from the configured web proxy identity", () => {
    const headers: ContainerAppsIdentityHeaders = {
      clientPrincipal: encodePrincipal({
        tenantId: "tenant-stratton",
        actorId: "web-proxy-object-id",
        roles: []
      }),
      forwardedPrincipal: encodePrincipal({
        tenantId: "tenant-stratton",
        actorId: "human-object-id",
        roles: [
          "Stratton.Demo.ProjectDanube.Access",
          "Stratton.Demo.EvidenceToDecision",
          "Stratton.Demo.Analyst"
        ]
      })
    };

    expect(
      resolveContainerAppsIdentity(headers, {
        expectedTenantId: "tenant-stratton",
        trustedProxyPrincipalId: "web-proxy-object-id"
      })
    ).toEqual({
      actorId: "human-object-id",
      tenantId: "tenant-stratton",
      principalType: "HUMAN",
      roles: [
        "Stratton.Demo.Analyst",
        "Stratton.Demo.EvidenceToDecision",
        "Stratton.Demo.ProjectDanube.Access"
      ]
    });
  });

  it("rejects a spoofed forwarded principal from an untrusted caller", () => {
    expect(() =>
      resolveContainerAppsIdentity(
        {
          clientPrincipal: encodePrincipal({
            tenantId: "tenant-stratton",
            actorId: "untrusted-caller",
            roles: ["Stratton.Demo.ProjectDanube.Access"]
          }),
          forwardedPrincipal: encodePrincipal({
            tenantId: "tenant-stratton",
            actorId: "spoofed-human",
            roles: ["Stratton.Demo.CommitteePreparer"]
          })
        },
        {
          expectedTenantId: "tenant-stratton",
          trustedProxyPrincipalId: "web-proxy-object-id"
        }
      )
    ).toThrowError(/UNTRUSTED_FORWARDED_IDENTITY/);
  });

  it("rejects a principal from another tenant", () => {
    expect(() =>
      resolveContainerAppsIdentity(
        {
          clientPrincipal: encodePrincipal({
            tenantId: "other-tenant",
            actorId: "human-object-id",
            roles: ["Stratton.Demo.ProjectDanube.Access"]
          })
        },
        {
          expectedTenantId: "tenant-stratton",
          trustedProxyPrincipalId: "web-proxy-object-id"
        }
      )
    ).toThrowError(/TENANT_NOT_AUTHORISED/);
  });
});
