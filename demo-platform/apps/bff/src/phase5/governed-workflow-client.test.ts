import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type {
  Phase5Client,
  WorkflowSupportingOperations
} from "./phase5-client.js";
import type {
  AnalysisBundleStatus,
  DemoAuthorityClient
} from "./demo-authority-client.js";
import {
  createAuthoritativeEvidenceAdmissionWorkflowClient,
  createAuthoritativeBundleWorkflowClient,
  createLegacyGovernedWorkflowClientForCompatibilityTests
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

describe("createLegacyGovernedWorkflowClientForCompatibilityTests", () => {
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

    const client = createLegacyGovernedWorkflowClientForCompatibilityTests({
      authority,
      supporting
    });
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

    const client = createLegacyGovernedWorkflowClientForCompatibilityTests({
      authority,
      supporting
    });

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
    const client = createLegacyGovernedWorkflowClientForCompatibilityTests({
      authority,
      supporting
    });

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
  const evidence = [
    {
      evidenceId: "evidence-board-pack",
      evidenceVersionId: "evidence-board-pack-v1",
      ordinal: 1
    }
  ];
  const bundle = {
    tenantId: "tenant-stratton",
    caseId: "project-danube",
    analysisBundleId: "bundle-1",
    evidenceManifestHash: createHash("sha256")
      .update(
        JSON.stringify({
          tenantId: "tenant-stratton",
          caseId: "project-danube",
          evidence
        })
      )
      .digest("hex"),
    modelRoute: "TERRA" as const,
    modelDeploymentId: "terra-grounded-analysis",
    routeEvidenceId: "SEC-EVID-TERRA-ROUTE-v1",
    promptTemplateVersion: "stratton-workbench-v2",
    requestFingerprint: "b".repeat(64),
    status: "DRAFT_ONLY_READY" as const,
    outputKind: "DRAFT_ONLY" as const,
    unsupportedClaims: 0,
    subjectVersion: "c".repeat(64),
    evidence,
    citationCounts: {
      totalClaims: 1,
      citedClaims: 1,
      materialClaims: 1,
      citedMaterialClaims: 1,
      unsupportedClaims: 0
    }
  };

  return {
    admitEvidence: vi.fn(async () => undefined),
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

function withAuthoritativeManifest(
  bundle: AnalysisBundleStatus
): AnalysisBundleStatus {
  return {
    ...bundle,
    evidenceManifestHash: createHash("sha256")
      .update(
        JSON.stringify({
          tenantId: bundle.tenantId,
          caseId: bundle.caseId,
          evidence: [...bundle.evidence]
            .sort((left, right) => left.ordinal - right.ordinal)
            .map(({ evidenceId, evidenceVersionId, ordinal }) => ({
              evidenceId,
              evidenceVersionId,
              ordinal
            }))
        })
      )
      .digest("hex")
  };
}

describe("createAuthoritativeEvidenceAdmissionWorkflowClient", () => {
  it("runs Phase 5 authority before the Azure extraction and indexing chain", async () => {
    const calls: string[] = [];
    const authority = authorityBundleClient(calls);
    vi.mocked(authority.admitEvidence).mockImplementation(async () => {
      calls.push("phase5:admitEvidence");
    });
    const supporting = supportingOperations();
    vi.mocked(supporting.afterEvidenceAdmitted).mockImplementation(async () => {
      calls.push("azure:extractAndIndex");
    });
    const client = createAuthoritativeEvidenceAdmissionWorkflowClient({
      authority,
      supporting
    });

    await client.admit({
      tenantId: "tenant-stratton",
      caseId: "project-danube",
      evidenceId: "evidence-board-pack",
      idempotencyKey: "admit:project-danube:evidence-board-pack",
      correlationId: "corr-admit"
    });

    expect(calls).toEqual(["phase5:admitEvidence", "azure:extractAndIndex"]);
  });

  it("does not run Azure extraction when Phase 5 denies evidence admission", async () => {
    const authority = authorityBundleClient([]);
    vi.mocked(authority.admitEvidence).mockRejectedValue(
      new Error("authority denied")
    );
    const supporting = supportingOperations();
    const client = createAuthoritativeEvidenceAdmissionWorkflowClient({
      authority,
      supporting
    });

    await expect(
      client.admit({
        tenantId: "tenant-stratton",
        caseId: "project-danube",
        evidenceId: "evidence-board-pack",
        idempotencyKey: "admit:project-danube:evidence-board-pack",
        correlationId: "corr-admit"
      })
    ).rejects.toThrow("authority denied");
    expect(supporting.afterEvidenceAdmitted).not.toHaveBeenCalled();
  });

  it("does not report admission success when the Azure supporting chain fails", async () => {
    const authority = authorityBundleClient([]);
    const supporting = supportingOperations();
    vi.mocked(supporting.afterEvidenceAdmitted).mockRejectedValue(
      new Error("indexing unavailable")
    );
    const client = createAuthoritativeEvidenceAdmissionWorkflowClient({
      authority,
      supporting
    });

    await expect(
      client.admit({
        tenantId: "tenant-stratton",
        caseId: "project-danube",
        evidenceId: "evidence-board-pack",
        idempotencyKey: "admit:project-danube:evidence-board-pack",
        correlationId: "corr-admit"
      })
    ).rejects.toThrow("indexing unavailable");
  });
});

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
      modelRoute: "TERRA",
      modelDeploymentId: "terra-grounded-analysis",
      routeEvidenceId: "SEC-EVID-TERRA-ROUTE-v1",
      promptTemplateVersion: "stratton-workbench-v2",
      requestFingerprint: "b".repeat(64),
      evidenceIds: ["evidence-board-pack"],
      analystQuestion: "Challenge management EBITDA quality",
      taskClass: "CROSS_DOCUMENT_COMPARISON",
      complete: (accepted) => ({
        tenantId: "tenant-stratton",
        caseId: "project-danube",
        analysisBundleId: "bundle-1",
        outputManifestHash: "c".repeat(64),
        evidenceManifestHash: accepted.evidenceManifestHash,
        modelRoute: accepted.modelRoute,
        modelDeploymentId: accepted.modelDeploymentId,
        routeEvidenceId: accepted.routeEvidenceId,
        status: "DRAFT_ONLY_READY",
        citationCounts: {
          totalClaims: 1,
          citedClaims: 1,
          materialClaims: 1,
          citedMaterialClaims: 1,
          unsupportedClaims: 0
        }
      })
    });

    expect(callOrder).toEqual([
      "phase5:createBundle",
      "azure:requestAnalysis",
      "phase5:completeBundle",
      "phase5:getBundle"
    ]);
    expect(result.subjectVersion).toBe("c".repeat(64));
    expect(authority.completeAnalysisBundle).toHaveBeenCalledWith(
      expect.objectContaining({
        outputManifestHash: "c".repeat(64),
        evidenceManifestHash: result.evidenceManifestHash,
        modelRoute: "TERRA",
        modelDeploymentId: "terra-grounded-analysis",
        routeEvidenceId: "SEC-EVID-TERRA-ROUTE-v1",
        citationCounts: expect.objectContaining({
          materialClaims: 1,
          citedMaterialClaims: 1
        })
      })
    );
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

  it("revalidates a ready bundle and skips Azure only when every authority field matches", async () => {
    const calls: string[] = [];
    const authority = authorityBundleClient(calls);
    const ready = await vi.mocked(authority.getAnalysisBundle)("bundle-1");
    vi.mocked(authority.createAnalysisBundle).mockImplementation(async () => {
      calls.push("phase5:createBundle");
      return ready;
    });
    vi.mocked(authority.getAnalysisBundle).mockImplementation(async () => {
      calls.push("phase5:getBundle");
      return ready;
    });
    calls.length = 0;
    const supporting = { requestAnalysis: vi.fn(async () => undefined) };
    const client = createAuthoritativeBundleWorkflowClient({ authority, supporting });

    await expect(
      client.run({
        tenantId: "tenant-stratton",
        caseId: "project-danube",
        analysisBundleId: "bundle-1",
        modelRoute: "TERRA",
        modelDeploymentId: "terra-grounded-analysis",
        routeEvidenceId: "SEC-EVID-TERRA-ROUTE-v1",
        promptTemplateVersion: "stratton-workbench-v2",
        requestFingerprint: "b".repeat(64),
        evidenceIds: ["evidence-board-pack"],
        analystQuestion: "Challenge management EBITDA quality",
        taskClass: "CROSS_DOCUMENT_COMPARISON",
        complete: () => {
          throw new Error("ready bundle must not be completed again");
        }
      })
    ).resolves.toMatchObject({ status: "DRAFT_ONLY_READY" });

    expect(calls).toEqual(["phase5:createBundle", "phase5:getBundle"]);
    expect(supporting.requestAnalysis).not.toHaveBeenCalled();
  });

  it("fails closed instead of reusing a ready bundle from another tenant", async () => {
    const authority = authorityBundleClient([]);
    const ready = await authority.getAnalysisBundle("bundle-1");
    vi.mocked(authority.createAnalysisBundle).mockResolvedValue(
      withAuthoritativeManifest({
        ...ready,
        tenantId: "tenant-other"
      })
    );
    const supporting = { requestAnalysis: vi.fn(async () => undefined) };
    const client = createAuthoritativeBundleWorkflowClient({ authority, supporting });

    await expect(
      client.run({
        tenantId: "tenant-stratton",
        caseId: "project-danube",
        analysisBundleId: "bundle-1",
        modelRoute: "TERRA",
        modelDeploymentId: "terra-grounded-analysis",
        routeEvidenceId: "SEC-EVID-TERRA-ROUTE-v1",
        promptTemplateVersion: "stratton-workbench-v2",
        requestFingerprint: "b".repeat(64),
        evidenceIds: ["evidence-board-pack"],
        analystQuestion: "Challenge management EBITDA quality",
        taskClass: "CROSS_DOCUMENT_COMPARISON",
        complete: () => {
          throw new Error("mismatched bundle must not complete");
        }
      })
    ).rejects.toMatchObject({
      code: "STATE_CONFLICT",
      message: "ANALYSIS_BUNDLE_IDENTITY_MISMATCH"
    });
    expect(supporting.requestAnalysis).not.toHaveBeenCalled();
  });

  it.each([
    [
      "case",
      (bundle: AnalysisBundleStatus) =>
        withAuthoritativeManifest({ ...bundle, caseId: "project-other" })
    ],
    [
      "request fingerprint",
      (bundle: AnalysisBundleStatus) => ({
        ...bundle,
        requestFingerprint: "d".repeat(64)
      })
    ],
    [
      "evidence manifest",
      (bundle: AnalysisBundleStatus) => ({
        ...bundle,
        evidenceManifestHash: "e".repeat(64)
      })
    ],
    [
      "route evidence version",
      (bundle: AnalysisBundleStatus) => ({
        ...bundle,
        routeEvidenceId: "SEC-EVID-TERRA-ROUTE-v2"
      })
    ]
  ] as const)("rejects a ready bundle with mismatched %s", async (_label, mutate) => {
    const authority = authorityBundleClient([]);
    const ready = await authority.getAnalysisBundle("bundle-1");
    vi.mocked(authority.createAnalysisBundle).mockResolvedValue(mutate(ready));
    const supporting = { requestAnalysis: vi.fn(async () => undefined) };
    const client = createAuthoritativeBundleWorkflowClient({ authority, supporting });

    await expect(
      client.run({
        tenantId: "tenant-stratton",
        caseId: "project-danube",
        analysisBundleId: "bundle-1",
        modelRoute: "TERRA",
        modelDeploymentId: "terra-grounded-analysis",
        routeEvidenceId: "SEC-EVID-TERRA-ROUTE-v1",
        promptTemplateVersion: "stratton-workbench-v2",
        requestFingerprint: "b".repeat(64),
        evidenceIds: ["evidence-board-pack"],
        analystQuestion: "Challenge management EBITDA quality",
        taskClass: "CROSS_DOCUMENT_COMPARISON",
        complete: () => {
          throw new Error("mismatched bundle must not complete");
        }
      })
    ).rejects.toMatchObject({
      code: "STATE_CONFLICT",
      message: "ANALYSIS_BUNDLE_IDENTITY_MISMATCH"
    });
    expect(supporting.requestAnalysis).not.toHaveBeenCalled();
  });

  it("rejects a reused bundle outside the ready lifecycle", async () => {
    const authority = authorityBundleClient([]);
    const ready = await authority.getAnalysisBundle("bundle-1");
    vi.mocked(authority.createAnalysisBundle).mockResolvedValue({
      ...ready,
      status: "FAILED"
    });
    const supporting = { requestAnalysis: vi.fn(async () => undefined) };
    const client = createAuthoritativeBundleWorkflowClient({ authority, supporting });

    await expect(
      client.run({
        tenantId: "tenant-stratton",
        caseId: "project-danube",
        analysisBundleId: "bundle-1",
        modelRoute: "TERRA",
        modelDeploymentId: "terra-grounded-analysis",
        routeEvidenceId: "SEC-EVID-TERRA-ROUTE-v1",
        promptTemplateVersion: "stratton-workbench-v2",
        requestFingerprint: "b".repeat(64),
        evidenceIds: ["evidence-board-pack"],
        analystQuestion: "Challenge management EBITDA quality",
        taskClass: "CROSS_DOCUMENT_COMPARISON",
        complete: () => {
          throw new Error("failed bundle must not complete");
        }
      })
    ).rejects.toMatchObject({
      code: "STATE_CONFLICT",
      message: "ANALYSIS_BUNDLE_LIFECYCLE_MISMATCH"
    });
    expect(supporting.requestAnalysis).not.toHaveBeenCalled();
  });
});
