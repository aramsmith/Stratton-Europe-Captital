import { describe, expect, it } from "vitest";
import { assertAuthorized } from "./authorization.js";
import type { TrustedIdentity } from "./trusted-identity.js";

const policy = {
  expectedTenantId: "tenant-stratton",
  caseId: "project-danube",
  caseAccessRole: "Stratton.Demo.ProjectDanube.Access",
  purposeRole: "Stratton.Demo.EvidenceToDecision"
} as const;

function identity(roles: TrustedIdentity["roles"]): TrustedIdentity {
  return {
    actorId: "human-1",
    tenantId: "tenant-stratton",
    principalType: "HUMAN",
    roles
  };
}

describe("assertAuthorized", () => {
  it("requires tenant, case, purpose, and operation application roles", () => {
    expect(() =>
      assertAuthorized(
        identity([
          "Stratton.Demo.ProjectDanube.Access",
          "Stratton.Demo.EvidenceToDecision"
        ]),
        policy,
        "project-danube",
        "Stratton.Demo.CommitteePreparer"
      )
    ).toThrowError(/APPLICATION_ROLE_REQUIRED/);
  });

  it("rejects access to another case even when operation roles are present", () => {
    expect(() =>
      assertAuthorized(
        identity([
          "Stratton.Demo.ProjectDanube.Access",
          "Stratton.Demo.EvidenceToDecision",
          "Stratton.Demo.Analyst"
        ]),
        policy,
        "project-vltava",
        "Stratton.Demo.Analyst"
      )
    ).toThrowError(/CASE_NOT_AUTHORISED/);
  });

  it("allows a correctly scoped operation", () => {
    expect(() =>
      assertAuthorized(
        identity([
          "Stratton.Demo.ProjectDanube.Access",
          "Stratton.Demo.EvidenceToDecision",
          "Stratton.Demo.Analyst"
        ]),
        policy,
        "project-danube",
        "Stratton.Demo.Analyst"
      )
    ).not.toThrow();
  });
});
