import { describe, expect, it } from "vitest";
import { runWithTrustedRequestContext } from "../identity/request-context.js";
import { createLocalDemoAuthorityClient } from "./local-demo-authority-client.js";

const humanContext = {
  identity: {
    actorId: "human-object-id",
    tenantId: "tenant-stratton",
    principalType: "HUMAN" as const,
    roles: ["Stratton.Demo.ProjectDanube.Access"] as const
  },
  delegatedUserToken: {
    accessToken: "local-human-token",
    tenantId: "tenant-stratton",
    actorId: "human-object-id",
    scopes: ["access_as_user"],
    roles: ["DealContributor"]
  },
  correlationId: "corr-local-authority"
};

const bundleInput = {
  tenantId: "tenant-stratton",
  caseId: "project-danube",
  analysisBundleId: "bundle-local-1",
  evidenceManifestHash: "a".repeat(64),
  modelRoute: "TERRA" as const,
  modelDeploymentId: "terra-grounded-analysis",
  routeEvidenceId: "SEC-EVID-TERRA-ROUTE-v1",
  promptTemplateVersion: "stratton-workbench-v2",
  requestFingerprint: "b".repeat(64),
  evidenceIds: ["evidence-board-pack"]
};

describe("createLocalDemoAuthorityClient", () => {
  it("rejects construction outside LOCAL mode", () => {
    expect(() =>
      createLocalDemoAuthorityClient({ mode: "AZURE" } as never)
    ).toThrow("LOCAL_DEMO_AUTHORITY_REQUIRES_LOCAL_MODE");
  });

  it("requires human context for admission and bundle creation and application context for completion", async () => {
    let completionPrincipal:
      | {
          readonly principalType: "HUMAN";
          readonly tenantId: string;
          readonly applicationId?: undefined;
        }
      | {
          readonly principalType: "APPLICATION";
          readonly tenantId: string;
          readonly applicationId: string;
        } = {
      principalType: "HUMAN",
      tenantId: "tenant-stratton"
    };
    const client = createLocalDemoAuthorityClient({
      mode: "LOCAL",
      getCompletionPrincipal: () => completionPrincipal
    } as never);

    await runWithTrustedRequestContext(humanContext, async () => {
      await client.admitEvidence({
        tenantId: "tenant-stratton",
        caseId: "project-danube",
        evidenceId: "evidence-board-pack",
        idempotencyKey: "admit:project-danube:evidence-board-pack",
        correlationId: "corr-local-authority"
      });
      await expect(client.createAnalysisBundle(bundleInput)).resolves.toMatchObject({
        status: "QUEUED"
      });
      await expect(
        client.completeAnalysisBundle({
          tenantId: "tenant-stratton",
          caseId: "project-danube",
          analysisBundleId: "bundle-local-1",
          subjectVersion: "c".repeat(64),
          status: "DRAFT_ONLY_READY",
          unsupportedClaims: 0
        })
      ).rejects.toMatchObject({
        code: "POLICY_DENIED",
        message: "APPLICATION_COMPLETION_REQUIRED"
      });

      completionPrincipal = {
        principalType: "APPLICATION",
        tenantId: "tenant-stratton",
        applicationId: "local-demo-bff"
      };
      await expect(
        client.completeAnalysisBundle({
          tenantId: "tenant-stratton",
          caseId: "project-danube",
          analysisBundleId: "bundle-local-1",
          subjectVersion: "c".repeat(64),
          status: "DRAFT_ONLY_READY",
          unsupportedClaims: 0
        })
      ).resolves.toMatchObject({
        status: "DRAFT_ONLY_READY",
        subjectVersion: "c".repeat(64)
      });
    });
  });
});
