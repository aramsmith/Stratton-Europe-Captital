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
  it("resolves only the outer principal supplied by Container Apps Easy Auth", () => {
    const headers: ContainerAppsIdentityHeaders = {
      clientPrincipal: encodePrincipal({
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
        expectedTenantId: "tenant-stratton"
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

  it("does not allow a forwarded principal header to replace the outer principal", () => {
    expect(
      resolveContainerAppsIdentity(
        {
          clientPrincipal: encodePrincipal({
            tenantId: "tenant-stratton",
            actorId: "human-object-id",
            roles: ["Stratton.Demo.ProjectDanube.Access"]
          }),
          forwardedPrincipal: encodePrincipal({
            tenantId: "tenant-stratton",
            actorId: "spoofed-human",
            roles: ["Stratton.Demo.CommitteePreparer"]
          })
        } as ContainerAppsIdentityHeaders,
        {
          expectedTenantId: "tenant-stratton"
        }
      )
    ).toMatchObject({
      actorId: "human-object-id",
      roles: ["Stratton.Demo.ProjectDanube.Access"]
    });
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
          expectedTenantId: "tenant-stratton"
        }
      )
    ).toThrowError(/TENANT_NOT_AUTHORISED/);
  });
});
