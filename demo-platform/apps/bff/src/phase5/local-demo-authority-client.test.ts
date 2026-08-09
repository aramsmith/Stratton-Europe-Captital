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
          outputManifestHash: "c".repeat(64),
          evidenceManifestHash: (
            await client.getAnalysisBundle("bundle-local-1")
          ).evidenceManifestHash,
          modelRoute: "TERRA",
          modelDeploymentId: "terra-grounded-analysis",
          routeEvidenceId: "SEC-EVID-TERRA-ROUTE-v1",
          status: "DRAFT_ONLY_READY",
          citationCounts: {
            totalClaims: 2,
            citedClaims: 2,
            materialClaims: 1,
            citedMaterialClaims: 1,
            unsupportedClaims: 0
          }
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
      const bundle = await client.getAnalysisBundle("bundle-local-1");
      await expect(
        client.completeAnalysisBundle({
          tenantId: "tenant-stratton",
          caseId: "project-danube",
          analysisBundleId: "bundle-local-1",
          outputManifestHash: "c".repeat(64),
          evidenceManifestHash: bundle.evidenceManifestHash,
          modelRoute: "TERRA",
          modelDeploymentId: "terra-grounded-analysis",
          routeEvidenceId: "SEC-EVID-TERRA-ROUTE-v1",
          status: "DRAFT_ONLY_READY",
          citationCounts: {
            totalClaims: 2,
            citedClaims: 2,
            materialClaims: 1,
            citedMaterialClaims: 1,
            unsupportedClaims: 0
          }
        })
      ).resolves.toMatchObject({
        status: "DRAFT_ONLY_READY",
        subjectVersion: "c".repeat(64)
      });
    });
  });

  it("rejects wrong applications, stale binding, incomplete material claims, and conflicting completion replay", async () => {
    let applicationId = "wrong-local-app";
    const client = createLocalDemoAuthorityClient({
      mode: "LOCAL",
      getCompletionPrincipal: () => ({
        principalType: "APPLICATION",
        tenantId: "tenant-stratton",
        applicationId
      })
    });

    await runWithTrustedRequestContext(humanContext, async () => {
      await client.admitEvidence({
        tenantId: "tenant-stratton",
        caseId: "project-danube",
        evidenceId: "evidence-board-pack",
        idempotencyKey: "admit:project-danube:evidence-board-pack"
      });
      const created = await client.createAnalysisBundle(bundleInput);
      const validCompletion = {
        tenantId: "tenant-stratton",
        caseId: "project-danube",
        analysisBundleId: "bundle-local-1",
        outputManifestHash: "c".repeat(64),
        evidenceManifestHash: created.evidenceManifestHash,
        modelRoute: "TERRA" as const,
        modelDeploymentId: "terra-grounded-analysis",
        routeEvidenceId: "SEC-EVID-TERRA-ROUTE-v1",
        status: "DRAFT_ONLY_READY" as const,
        citationCounts: {
          totalClaims: 2,
          citedClaims: 2,
          materialClaims: 1,
          citedMaterialClaims: 1,
          unsupportedClaims: 0
        }
      };

      await expect(client.completeAnalysisBundle(validCompletion)).rejects.toMatchObject({
        code: "POLICY_DENIED",
        message: "APPLICATION_COMPLETION_REQUIRED"
      });
      applicationId = "local-demo-bff";
      await expect(
        client.completeAnalysisBundle({
          ...validCompletion,
          routeEvidenceId: "SEC-EVID-TERRA-ROUTE-v2"
        })
      ).rejects.toMatchObject({
        code: "STATE_CONFLICT",
        message: "ANALYSIS_BUNDLE_COMPLETION_BINDING_MISMATCH"
      });
      await expect(
        client.completeAnalysisBundle({
          ...validCompletion,
          citationCounts: {
            ...validCompletion.citationCounts,
            citedMaterialClaims: 0,
            unsupportedClaims: 1
          }
        })
      ).rejects.toMatchObject({
        code: "EVIDENCE_INCOMPLETE",
        message: "ANALYSIS_BUNDLE_COMPLETION_ASSESSMENT_INVALID"
      });

      await expect(client.completeAnalysisBundle(validCompletion)).resolves.toMatchObject({
        subjectVersion: validCompletion.outputManifestHash
      });
      await expect(
        client.completeAnalysisBundle({
          ...validCompletion,
          citationCounts: {
            unsupportedClaims: 0,
            citedMaterialClaims: 1,
            materialClaims: 1,
            citedClaims: 2,
            totalClaims: 2
          }
        })
      ).resolves.toMatchObject({
        subjectVersion: validCompletion.outputManifestHash
      });
      await expect(
        client.completeAnalysisBundle({
          ...validCompletion,
          outputManifestHash: "d".repeat(64)
        })
      ).rejects.toMatchObject({
        code: "STATE_CONFLICT",
        message: "ANALYSIS_BUNDLE_COMPLETION_CONFLICT"
      });
    });
  });
});
