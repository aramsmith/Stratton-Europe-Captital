import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createProjectDanubeState } from "@stratton/scenario-data";
import { AnalysisService } from "../analysis/analysis-service.js";
import { EvidenceService } from "../evidence/evidence-service.js";
import { GovernanceService } from "../governance/governance-service.js";
import type { Phase5Client } from "../phase5/phase5-client.js";
import { ReviewService } from "../reviews/review-service.js";
import { InMemoryScenarioRepository } from "../scenario/in-memory-scenario-repository.js";
import { ScenarioService } from "../scenario/scenario-service.js";
import { createDemoServer } from "../server.js";
import {
  createContainerAppsIdentityResolver,
  type IdentityResolver
} from "./identity-resolver.js";

function encodePrincipal(): string {
  return Buffer.from(
    JSON.stringify({
      auth_typ: "aad",
      claims: [
        { typ: "tid", val: "tenant-stratton" },
        { typ: "oid", val: "human-object-id" },
        { typ: "roles", val: "Stratton.Demo.ProjectDanube.Access" }
      ]
    }),
    "utf8"
  ).toString("base64");
}

function phase5Client(): Phase5Client {
  return {
    admitEvidence: vi.fn().mockResolvedValue(undefined),
    requestAnalysis: vi.fn().mockResolvedValue({ analysisRunId: "run-1", status: "QUEUED" }),
    submitReview: vi.fn().mockResolvedValue(undefined),
    prepareDraft: vi.fn().mockResolvedValue(undefined)
  };
}

describe("createContainerAppsIdentityResolver", () => {
  it("validates the Container Apps access token through the injected verifier", async () => {
    const tokenVerifier = {
      verify: vi.fn().mockResolvedValue({
        tid: "tenant-stratton",
        oid: "human-object-id",
        aud: "api://stratton-demo-bff",
        scp: "access_as_user",
        exp: 1_900_000_000
      })
    };
    const resolver = createContainerAppsIdentityResolver({
      expectedTenantId: "tenant-stratton",
      trustedProxyPrincipalId: "web-proxy-object-id",
      delegatedTokenPolicy: {
        expectedTenantId: "tenant-stratton",
        expectedAudience: "api://stratton-demo-bff",
        requiredScope: "access_as_user"
      },
      delegatedTokenVerifier: tokenVerifier
    });

    await expect(
      resolver.resolveDelegatedToken({
        header: (name: string) =>
          name.toLowerCase() === "x-ms-token-aad-access-token" ? "signed-user-jwt" : undefined
      })
    ).resolves.toMatchObject({
      actorId: "human-object-id",
      tenantId: "tenant-stratton",
      accessToken: "signed-user-jwt"
    });
    expect(tokenVerifier.verify).toHaveBeenCalledWith("signed-user-jwt");
  });

  it("rejects a request when the verified delegated actor differs from the trusted principal", async () => {
    const resolver = {
      resolve: async () => ({
        actorId: "principal-object-id",
        tenantId: "tenant-stratton",
        principalType: "HUMAN" as const,
        roles: [
          "Stratton.Demo.ProjectDanube.Access",
          "Stratton.Demo.EvidenceToDecision"
        ] as const
      }),
      resolveDelegatedToken: async () => ({
        accessToken: "signed-user-jwt",
        actorId: "different-object-id",
        tenantId: "tenant-stratton",
        scopes: ["access_as_user"],
        roles: []
      })
    } as IdentityResolver;
    const repository = new InMemoryScenarioRepository(createProjectDanubeState());
    const client = phase5Client();

    const response = await request(
      createDemoServer(
        {
          scenarioService: new ScenarioService(repository),
          evidenceService: new EvidenceService({ repository, phase5Client: client }),
          analysisService: new AnalysisService({ repository, phase5Client: client }),
          reviewService: new ReviewService({ repository, phase5Client: client }),
          governanceService: new GovernanceService({ repository })
        },
        {
          identityResolver: resolver,
          authorizationPolicy: {
            expectedTenantId: "tenant-stratton",
            caseId: "project-danube",
            caseAccessRole: "Stratton.Demo.ProjectDanube.Access",
            purposeRole: "Stratton.Demo.EvidenceToDecision"
          }
        }
      )
    ).get("/api/scenario");

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("POLICY_DENIED");
  });
});
