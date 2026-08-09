import { describe, expect, it, vi } from "vitest";
import type {
  Phase5Client,
  WorkflowSupportingOperations
} from "./phase5-client.js";
import type { DemoAuthorityClient } from "./demo-authority-client.js";
import {
  createAuthoritativeBundleWorkflowClient,
  createGovernedWorkflowClient
} from "./governed-workflow-client.js";

function authorityClient(): Phase5Client {
  return {
    admitEvidence: vi.fn().mockResolvedValue(undefined),
    requestAnalysis: vi.fn().mockResolvedValue({
      analysisRunId: "phase5-run-1",
      status: "QUEUED"
    }),
    submitReview: vi.fn().mockResolvedValue(undefined),
    prepareDraft: vi.fn().mockResolvedValue(undefined)
  };
}

function supportingOperations(): WorkflowSupportingOperations {
  return {
    afterEvidenceAdmitted: vi.fn().mockResolvedValue(undefined),
    afterAnalysisAccepted: vi.fn().mockResolvedValue(undefined),
    afterReviewAccepted: vi.fn().mockResolvedValue(undefined),
    afterDraftAccepted: vi.fn().mockResolvedValue(undefined)
  };
}

describe("createGovernedWorkflowClient", () => {
  it("calls immutable Phase 5 authority before Azure supporting analysis operations", async () => {
    const calls: string[] = [];
    const authority = authorityClient();
    const supporting = supportingOperations();
    vi.mocked(authority.requestAnalysis).mockImplementation(async () => {
      calls.push("authority");
      return { analysisRunId: "phase5-run-1", status: "QUEUED" };
    });
    vi.mocked(supporting.afterAnalysisAccepted).mockImplementation(async () => {
      calls.push("supporting");
    });

    const client = createGovernedWorkflowClient({ authority, supporting });
    const result = await client.requestAnalysis({
      caseId: "project-danube",
      evidenceIds: ["evidence-board-pack"],
      analystQuestion: "Challenge management EBITDA quality",
      route: "TERRA",
      taskClass: "CROSS_DOCUMENT_COMPARISON",
      modelDeploymentId: "terra-grounded-analysis",
      promptTemplateVersion: "stratton-workbench-v2:abc",
      analysisRequestFingerprint:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      idempotencyKey: "analysis:abc",
      correlationId: "corr-1"
    });

    expect(calls).toEqual(["authority", "supporting"]);
    expect(result.analysisRunId).toBe("phase5-run-1");
    expect(supporting.afterAnalysisAccepted).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisRunId: "phase5-run-1",
        idempotencyKey: "analysis:abc"
      })
    );
  });

  it("does not call supporting operations when Phase 5 denies the transition", async () => {
    const authority = authorityClient();
    const supporting = supportingOperations();
    vi.mocked(authority.prepareDraft).mockRejectedValue({
      code: "POLICY_DENIED",
      message: "Phase 5 denied preparation.",
      correlationId: "phase5-corr"
    });

    const client = createGovernedWorkflowClient({ authority, supporting });

    await expect(
      client.prepareDraft({
        caseId: "project-danube",
        analysisRunId: "phase5-run-1",
        subjectVersion: "v1",
        idempotencyKey: "draft:v1",
        correlationId: "corr-1"
      })
    ).rejects.toMatchObject({ code: "POLICY_DENIED" });
    expect(supporting.afterDraftAccepted).not.toHaveBeenCalled();
  });

  it("surfaces a supporting-operation failure after Phase 5 accepts without returning success", async () => {
    const authority = authorityClient();
    const supporting = supportingOperations();
    vi.mocked(supporting.afterEvidenceAdmitted).mockRejectedValue({
      code: "DEPENDENCY_UNAVAILABLE",
      message: "DOCUMENT_INTELLIGENCE_UNAVAILABLE",
      correlationId: "corr-support"
    });
    const client = createGovernedWorkflowClient({ authority, supporting });

    await expect(
      client.admitEvidence({
        caseId: "project-danube",
        evidenceId: "evidence-board-pack",
        idempotencyKey: "admit:project-danube:evidence-board-pack",
        correlationId: "corr-support"
      })
    ).rejects.toMatchObject({ code: "DEPENDENCY_UNAVAILABLE" });
    expect(authority.admitEvidence).toHaveBeenCalledTimes(1);
    expect(supporting.afterEvidenceAdmitted).toHaveBeenCalledTimes(1);
  });
});

function authorityBundleClient(calls: string[]): DemoAuthorityClient {
  const bundle = {
    tenantId: "tenant-stratton",
    caseId: "project-danube",
    analysisBundleId: "bundle-1",
    evidenceManifestHash: "a".repeat(64),
    modelRoute: "TERRA" as const,
    modelDeploymentId: "terra-grounded-analysis",
    routeEvidenceId: "SEC-EVID-TERRA-ROUTE-v1",
    promptTemplateVersion: "stratton-workbench-v2",
    requestFingerprint: "b".repeat(64),
    status: "DRAFT_ONLY_READY" as const,
    outputKind: "DRAFT_ONLY" as const,
    unsupportedClaims: 0,
    subjectVersion: "c".repeat(64),
    evidence: [
      {
        evidenceId: "evidence-board-pack",
        evidenceVersionId: "evidence-board-pack-v1",
        ordinal: 1
      }
    ],
    citationCounts: {
      totalClaims: 1,
      citedClaims: 1,
      unsupportedClaims: 0
    }
  };

  return {
    createAnalysisBundle: vi.fn(async () => {
      calls.push("phase5:createBundle");
      return { ...bundle, status: "QUEUED" as const };
    }),
    completeAnalysisBundle: vi.fn(async () => {
      calls.push("phase5:completeBundle");
      return bundle;
    }),
    getAnalysisBundle: vi.fn(async () => {
      calls.push("phase5:getBundle");
      return bundle;
    }),
    submitBundleReview: vi.fn(async () => undefined),
    prepareBundleDraft: vi.fn(async () => undefined),
    getModelRouteEvidence: vi.fn(async () => ({
      evidenceId: "SEC-EVID-TERRA-ROUTE-v1",
      status: "APPROVED" as const,
      resourceId: "/subscriptions/1/resourceGroups/rg/providers/Microsoft.CognitiveServices/accounts/terra",
      deploymentId: "terra-grounded-analysis",
      region: "westeurope",
      route: "TERRA" as const,
      apiVersion: "2025-01-01-preview",
      evidenceVersion: "v1",
      validFromIso: "2026-01-01T00:00:00.000Z",
      validUntilIso: "2027-01-01T00:00:00.000Z"
    }))
  };
}

describe("createAuthoritativeBundleWorkflowClient", () => {
  it("authorizes, analyzes, completes, and fetches the authoritative bundle in order", async () => {
    const callOrder: string[] = [];
    const authority = authorityBundleClient(callOrder);
    const client = createAuthoritativeBundleWorkflowClient({
      authority,
      supporting: {
        requestAnalysis: vi.fn(async () => {
          callOrder.push("azure:requestAnalysis");
        })
      }
    });

    const result = await client.run({
      tenantId: "tenant-stratton",
      caseId: "project-danube",
      analysisBundleId: "bundle-1",
      evidenceManifestHash: "a".repeat(64),
      modelRoute: "TERRA",
      modelDeploymentId: "terra-grounded-analysis",
      routeEvidenceId: "SEC-EVID-TERRA-ROUTE-v1",
      promptTemplateVersion: "stratton-workbench-v2",
      requestFingerprint: "b".repeat(64),
      evidenceIds: ["evidence-board-pack"],
      analystQuestion: "Challenge management EBITDA quality",
      taskClass: "CROSS_DOCUMENT_COMPARISON",
      complete: () => ({
        tenantId: "tenant-stratton",
        caseId: "project-danube",
        analysisBundleId: "bundle-1",
        subjectVersion: "c".repeat(64),
        status: "DRAFT_ONLY_READY",
        unsupportedClaims: 0
      })
    });

    expect(callOrder).toEqual([
      "phase5:createBundle",
      "azure:requestAnalysis",
      "phase5:completeBundle",
      "phase5:getBundle"
    ]);
    expect(result.subjectVersion).toBe("c".repeat(64));
  });

  it("does not run Azure analysis when authority denies bundle creation", async () => {
    const authority = authorityBundleClient([]);
    vi.mocked(authority.createAnalysisBundle).mockRejectedValue(
      new Error("authority denied")
    );
    const supporting = { requestAnalysis: vi.fn(async () => undefined) };
    const client = createAuthoritativeBundleWorkflowClient({ authority, supporting });

    await expect(
      client.run({
        tenantId: "tenant-stratton",
        caseId: "project-danube",
        analysisBundleId: "bundle-1",
        evidenceManifestHash: "a".repeat(64),
        modelRoute: "TERRA",
        modelDeploymentId: "terra-grounded-analysis",
        routeEvidenceId: "SEC-EVID-TERRA-ROUTE-v1",
        promptTemplateVersion: "stratton-workbench-v2",
        requestFingerprint: "b".repeat(64),
        evidenceIds: ["evidence-board-pack"],
        analystQuestion: "Challenge management EBITDA quality",
        taskClass: "CROSS_DOCUMENT_COMPARISON",
        complete: () => {
          throw new Error("completion must not run");
        }
      })
    ).rejects.toThrow("authority denied");
    expect(supporting.requestAnalysis).not.toHaveBeenCalled();
  });

  it("does not complete a bundle when Azure analysis fails", async () => {
    const authority = authorityBundleClient([]);
    const supporting = {
      requestAnalysis: vi.fn(async () => {
        throw new Error("Azure unavailable");
      })
    };
    const client = createAuthoritativeBundleWorkflowClient({ authority, supporting });

    await expect(
      client.run({
        tenantId: "tenant-stratton",
        caseId: "project-danube",
        analysisBundleId: "bundle-1",
        evidenceManifestHash: "a".repeat(64),
        modelRoute: "TERRA",
        modelDeploymentId: "terra-grounded-analysis",
        routeEvidenceId: "SEC-EVID-TERRA-ROUTE-v1",
        promptTemplateVersion: "stratton-workbench-v2",
        requestFingerprint: "b".repeat(64),
        evidenceIds: ["evidence-board-pack"],
        analystQuestion: "Challenge management EBITDA quality",
        taskClass: "CROSS_DOCUMENT_COMPARISON",
        complete: () => {
          throw new Error("completion must not run");
        }
      })
    ).rejects.toThrow("Azure unavailable");
    expect(authority.completeAnalysisBundle).not.toHaveBeenCalled();
  });
});
