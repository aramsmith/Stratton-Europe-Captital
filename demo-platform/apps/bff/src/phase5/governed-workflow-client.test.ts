import { describe, expect, it, vi } from "vitest";
import type {
  Phase5Client,
  WorkflowSupportingOperations
} from "./phase5-client.js";
import { createGovernedWorkflowClient } from "./governed-workflow-client.js";

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
