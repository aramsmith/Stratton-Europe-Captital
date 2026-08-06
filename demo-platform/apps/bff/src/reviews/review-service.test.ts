import { describe, expect, it, vi } from "vitest";
import type { ScenarioState } from "@stratton/contracts";
import { createProjectDanubeState } from "@stratton/scenario-data";
import type { Phase5Client } from "../phase5/phase5-client.js";
import { InMemoryScenarioRepository } from "../scenario/in-memory-scenario-repository.js";
import { ReviewService } from "./review-service.js";

function createPhase5ClientDouble() {
  return {
    requestAnalysis: vi.fn<Phase5Client["requestAnalysis"]>().mockResolvedValue({
      analysisRunId: "run-terra-1",
      status: "QUEUED"
    }),
    admitEvidence: vi.fn<Phase5Client["admitEvidence"]>().mockResolvedValue(undefined),
    submitReview: vi.fn<Phase5Client["submitReview"]>().mockResolvedValue(undefined),
    prepareDraft: vi.fn<Phase5Client["prepareDraft"]>().mockResolvedValue(undefined)
  } satisfies Phase5Client;
}

function approvedReview(
  reviewType: "DEAL" | "LEGAL" | "COMPLIANCE",
  findingId: string
): ScenarioState["reviews"][number] {
  return {
    reviewId: `review-${reviewType.toLowerCase()}-approved`,
    reviewType,
    decision: "APPROVED",
    findingId,
    subjectVersion: `${findingId}-v2`
  };
}

function pendingReview(
  reviewType: "DEAL" | "LEGAL" | "COMPLIANCE",
  findingId: string
): ScenarioState["reviews"][number] {
  return {
    reviewId: `review-${reviewType.toLowerCase()}-pending`,
    reviewType,
    decision: "PENDING",
    findingId,
    subjectVersion: `${findingId}-v2`
  };
}

function createReviewedScenario(
  reviews: ScenarioState["reviews"] = []
): ScenarioState {
  const scenario = createProjectDanubeState();
  scenario.stage = "REVIEW";
  scenario.evidence = scenario.evidence.map((evidence) => ({
    ...evidence,
    admissionStatus: "ADMITTED",
    provenanceStatus: "VERIFIED"
  }));
  scenario.latestAnalysisRun = {
    analysisRunId: "run-terra-1",
    route: "TERRA",
    taskClass: "CROSS_DOCUMENT_COMPARISON",
    analystQuestion: "Challenge management EBITDA quality",
    questionHash: "95d4ab5821abf3ec7fa4b35f667fa5e3b71db280c5f7ab455ecb6c10f379b4e4",
    admittedEvidenceIds: [
      "evidence-board-pack",
      "evidence-environmental-permit",
      "evidence-erp-rebates",
      "evidence-qoe-report"
    ],
    evidenceSetHash: "7a0cbdb7f6cff1ce34618a74be93fd6928840fa2712f822e7ef76a08b85c4f99",
    analysisRequestFingerprint:
      "9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
    promptTemplateVersion:
      "stratton-workbench-v2:9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
    authorityGateRole: "HUMAN_ANALYST_REVIEW_GATE"
  };
  scenario.findings = [
    {
      findingId: "finding-ebitda-quality",
      title: "Adjusted EBITDA quality",
      summary: "Human adjusted EBITDA challenge kept for committee review.",
      originalAiSummary: "Reported adjusted EBITDA may be overstated by EUR 4.2–5.1 million.",
      materiality: "HIGH",
      status: "ACCEPTED",
      route: "TERRA",
      citations: [
        {
          citationId: "citation-board-pack-42",
          evidenceId: "evidence-board-pack",
          locator: "page 42",
          accessible: true
        },
        {
          citationId: "citation-qoe-18",
          evidenceId: "evidence-qoe-report",
          locator: "page 18",
          accessible: true
        }
      ],
      textHistory: [
        {
          versionId: "finding-ebitda-quality-v1",
          actorType: "AI",
          action: "GENERATED",
          summary: "Reported adjusted EBITDA may be overstated by EUR 4.2–5.1 million.",
          occurredAtIso: "2026-08-06T10:05:00.000Z"
        },
        {
          versionId: "finding-ebitda-quality-v2",
          actorType: "HUMAN",
          action: "ACCEPTED",
          summary: "Human adjusted EBITDA challenge kept for committee review.",
          occurredAtIso: "2026-08-06T10:10:00.000Z"
        }
      ],
      analysisRunId: "run-terra-1",
      analysisRequestFingerprint:
        "9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
      authorityGateRole: "HUMAN_ANALYST_REVIEW_GATE"
    },
    {
      findingId: "finding-customer-concentration",
      title: "Customer concentration",
      summary: "Customer rebate concentration remains above the approved downside threshold.",
      originalAiSummary:
        "Customer rebate concentration remains above the approved downside threshold.",
      materiality: "MEDIUM",
      status: "ACCEPTED",
      route: "TERRA",
      citations: [
        {
          citationId: "citation-erp-812-886",
          evidenceId: "evidence-erp-rebates",
          locator: "rows 812-886",
          accessible: true
        }
      ],
      textHistory: [
        {
          versionId: "finding-customer-concentration-v1",
          actorType: "AI",
          action: "GENERATED",
          summary: "Customer rebate concentration remains above the approved downside threshold.",
          occurredAtIso: "2026-08-06T10:05:00.000Z"
        },
        {
          versionId: "finding-customer-concentration-v2",
          actorType: "HUMAN",
          action: "ACCEPTED",
          summary: "Customer rebate concentration remains above the approved downside threshold.",
          occurredAtIso: "2026-08-06T10:10:00.000Z"
        }
      ],
      analysisRunId: "run-terra-1",
      analysisRequestFingerprint:
        "9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
      authorityGateRole: "HUMAN_ANALYST_REVIEW_GATE"
    },
    {
      findingId: "finding-permit-transfer",
      title: "Permit transfer readiness",
      summary: "Permit transfer requires controlled completion steps before close.",
      originalAiSummary: "Permit transfer requires controlled completion steps before close.",
      materiality: "HIGH",
      status: "ACCEPTED",
      route: "TERRA",
      citations: [
        {
          citationId: "citation-permit-2049",
          evidenceId: "evidence-environmental-permit",
          locator: "Permit reference: CZ-EP-2049",
          accessible: true
        }
      ],
      textHistory: [
        {
          versionId: "finding-permit-transfer-v1",
          actorType: "AI",
          action: "GENERATED",
          summary: "Permit transfer requires controlled completion steps before close.",
          occurredAtIso: "2026-08-06T10:05:00.000Z"
        },
        {
          versionId: "finding-permit-transfer-v2",
          actorType: "HUMAN",
          action: "ACCEPTED",
          summary: "Permit transfer requires controlled completion steps before close.",
          occurredAtIso: "2026-08-06T10:10:00.000Z"
        }
      ],
      analysisRunId: "run-terra-1",
      analysisRequestFingerprint:
        "9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
      authorityGateRole: "HUMAN_ANALYST_REVIEW_GATE"
    }
  ];
  scenario.reviews = reviews;
  return scenario;
}

function withCurrentSecurityGatePasses(state: ScenarioState): ScenarioState {
  const fingerprint = state.latestAnalysisRun?.analysisRequestFingerprint;
  if (!fingerprint) {
    throw new Error("analysis fingerprint required");
  }
  state.governanceEvents.push(
    ...Array.from({ length: 12 }, (_, index) => {
      const ordinal = String(index + 1).padStart(3, "0");
      return {
        eventId: `gate-pass-${ordinal}`,
        type: "SECURITY_GATE_EVIDENCE_RECORDED",
        outcome: "SUCCESS" as const,
        occurredAtIso: `2026-08-06T11:${String(index).padStart(2, "0")}:00.000Z`,
        correlationId: "corr-gate-suite",
        detail: `DETERMINISTIC_GATE_PASS:CC002-R2-SEC-GATE-${ordinal}`,
        metadata: {
          securityGateId: `CC002-R2-SEC-GATE-${ordinal}`,
          securityGateEvidenceId: `STRATTON-DEMO-SEC-GATE-${ordinal}-v1`,
          analysisRequestFingerprint: fingerprint
        }
      };
    })
  );
  return state;
}

describe("ReviewService", () => {
  it("rejects a review type that is not eligible for the finding domains", async () => {
    const repository = new InMemoryScenarioRepository(createReviewedScenario());
    const phase5Client = createPhase5ClientDouble();
    const service = new ReviewService({ repository, phase5Client });

    await expect(
      service.submitReview({
        caseId: "project-danube",
        findingId: "finding-ebitda-quality",
        reviewType: "LEGAL",
        decision: "APPROVED",
        rationale: "An arbitrary approval must not satisfy Legal review.",
        subjectVersion: "finding-ebitda-quality-v2",
        principalType: "HUMAN",
        correlationId: "corr-ineligible-review"
      })
    ).rejects.toMatchObject({
      code: "POLICY_DENIED",
      message: "REVIEW_TYPE_NOT_ELIGIBLE_FOR_FINDING"
    });
    expect(phase5Client.submitReview).not.toHaveBeenCalled();
  });

  it("requires current approvals for each exact applicable finding and version", async () => {
    const scenario = createReviewedScenario([
      approvedReview("DEAL", "finding-ebitda-quality"),
      approvedReview("LEGAL", "finding-ebitda-quality"),
      approvedReview("COMPLIANCE", "finding-ebitda-quality")
    ]);
    const service = new ReviewService({
      repository: new InMemoryScenarioRepository(scenario),
      phase5Client: createPhase5ClientDouble()
    });

    await expect(
      service.prepareRecommendation({
        caseId: "project-danube",
        principalType: "HUMAN",
        correlationId: "corr-arbitrary-approvals"
      })
    ).rejects.toMatchObject({
      code: "POLICY_DENIED",
      message: "LEGAL_REVIEW_REQUIRED:finding-permit-transfer"
    });
  });

  it("blocks committee preparation while Legal review is pending", async () => {
    const repository = new InMemoryScenarioRepository(
      createReviewedScenario([
        approvedReview("DEAL", "finding-ebitda-quality"),
        pendingReview("LEGAL", "finding-permit-transfer"),
        approvedReview("COMPLIANCE", "finding-permit-transfer")
      ])
    );
    const service = new ReviewService({
      repository,
      phase5Client: createPhase5ClientDouble()
    });

    await expect(
      service.prepareRecommendation({
        caseId: "project-danube",
        principalType: "HUMAN",
        correlationId: "corr-prepare-blocked"
      })
    ).rejects.toMatchObject({
      code: "POLICY_DENIED",
      message: "LEGAL_REVIEW_REQUIRED:finding-permit-transfer"
    });

    const nextState = (await repository.load()).state;
    expect(nextState.governanceEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "COMMITTEE_PACK_PREPARATION_DENIED",
          outcome: "DENY",
          correlationId: "corr-prepare-blocked",
          detail: "LEGAL_REVIEW_REQUIRED:finding-permit-transfer"
        })
      ])
    );
  });

  it("blocks committee preparation until all mandatory security gates have current PASS evidence", async () => {
    const scenario = createReviewedScenario([
      approvedReview("DEAL", "finding-ebitda-quality"),
      approvedReview("LEGAL", "finding-permit-transfer"),
      approvedReview("COMPLIANCE", "finding-permit-transfer")
    ]);
    const phase5Client = createPhase5ClientDouble();
    const service = new ReviewService({
      repository: new InMemoryScenarioRepository(scenario),
      phase5Client
    });

    await expect(
      service.prepareRecommendation({
        caseId: "project-danube",
        principalType: "HUMAN",
        correlationId: "corr-gates-not-run"
      })
    ).rejects.toMatchObject({
      code: "POLICY_DENIED",
      message: "SECURITY_GATE_CC002-R2-SEC-GATE-001_NOT_RUN"
    });
    expect(phase5Client.prepareDraft).not.toHaveBeenCalled();
  });

  it("requires a human specialist review and appends it to the scenario projection", async () => {
    const repository = new InMemoryScenarioRepository(createReviewedScenario());
    const phase5Client = createPhase5ClientDouble();
    const service = new ReviewService({
      repository,
      phase5Client,
      createId: () => "review-legal-1",
      now: () => "2026-08-06T10:20:00.000Z"
    });

    await expect(
      service.submitReview({
        caseId: "project-danube",
        findingId: "finding-permit-transfer",
        reviewType: "LEGAL",
        decision: "APPROVED",
        rationale: "Permit transfer completion steps are documented.",
        subjectVersion: "finding-permit-transfer-v2",
        principalType: "SERVICE",
        correlationId: "corr-review-service"
      })
    ).rejects.toMatchObject({ code: "POLICY_DENIED" });

    expect((await repository.load()).state.governanceEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "SPECIALIST_REVIEW_DENIED",
          outcome: "DENY",
          correlationId: "corr-review-service"
        })
      ])
    );

    const nextState = await service.submitReview({
      caseId: "project-danube",
      findingId: "finding-permit-transfer",
      reviewType: "LEGAL",
      decision: "APPROVED",
      rationale: "Permit transfer completion steps are documented.",
      subjectVersion: "finding-permit-transfer-v2",
      principalType: "HUMAN",
      correlationId: "corr-review-human"
    });

    expect(phase5Client.submitReview).toHaveBeenCalledWith({
      caseId: "project-danube",
      analysisRunId: "run-terra-1",
      reviewType: "LEGAL",
      decision: "APPROVED",
      rationale: "Permit transfer completion steps are documented.",
      subjectVersion: "finding-permit-transfer-v2",
      idempotencyKey: "review:LEGAL:finding-permit-transfer:finding-permit-transfer-v2",
      correlationId: "corr-review-human"
    });
    expect(nextState.reviews).toContainEqual({
      reviewId: "review-legal-1",
      reviewType: "LEGAL",
      decision: "APPROVED",
      findingId: "finding-permit-transfer",
      subjectVersion: "finding-permit-transfer-v2"
    });
    expect(nextState.governanceEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventId: "review-legal-1",
          type: "SPECIALIST_REVIEW_RECORDED",
          outcome: "SUCCESS",
          correlationId: "corr-review-human",
          detail: "LEGAL:APPROVED:finding-permit-transfer"
        })
      ])
    );
  });

  it("prepares a committee-pack draft only after mandatory approvals resolve every material condition", async () => {
    const repository = new InMemoryScenarioRepository(
      withCurrentSecurityGatePasses(
        createReviewedScenario([
          approvedReview("DEAL", "finding-ebitda-quality"),
          approvedReview("LEGAL", "finding-permit-transfer"),
          approvedReview("COMPLIANCE", "finding-permit-transfer")
        ])
      )
    );
    const phase5Client = createPhase5ClientDouble();
    const service = new ReviewService({
      repository,
      phase5Client,
      createId: () => "event-committee-pack",
      now: () => "2026-08-06T10:30:00.000Z"
    });

    const nextState = await service.prepareRecommendation({
      caseId: "project-danube",
      principalType: "HUMAN",
      correlationId: "corr-committee-pack"
    });

    expect(phase5Client.prepareDraft).toHaveBeenCalledWith({
      caseId: "project-danube",
      analysisRunId: "run-terra-1",
      subjectVersion: expect.stringMatching(/^[a-f0-9]{64}$/),
      idempotencyKey: expect.stringContaining("draft:run-terra-1"),
      correlationId: "corr-committee-pack"
    });
    expect(nextState.stage).toBe("COMMITTEE_PREPARATION");
    expect(nextState.governanceEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventId: "event-committee-pack",
          type: "COMMITTEE_PACK_DRAFT_PREPARED",
          outcome: "SUCCESS",
          correlationId: "corr-committee-pack"
        })
      ])
    );
  });

  it("re-requires specialist approval when an accepted material finding changes after approval", async () => {
    const scenario = createReviewedScenario([
      approvedReview("DEAL", "finding-ebitda-quality"),
      approvedReview("LEGAL", "finding-permit-transfer"),
      approvedReview("COMPLIANCE", "finding-permit-transfer")
    ]);
    scenario.findings = scenario.findings.map((finding) =>
      finding.findingId === "finding-permit-transfer"
        ? {
            ...finding,
            summary: "Permit transfer requires a renewed regulatory condition review.",
            textHistory: [
              ...finding.textHistory,
              {
                versionId: "finding-permit-transfer-v3",
                actorType: "HUMAN",
                action: "EDITED",
                summary: "Permit transfer requires a renewed regulatory condition review.",
                occurredAtIso: "2026-08-06T10:25:00.000Z"
              }
            ]
          }
        : finding
    );

    const service = new ReviewService({
      repository: new InMemoryScenarioRepository(scenario),
      phase5Client: createPhase5ClientDouble()
    });

    await expect(
      service.prepareRecommendation({
        caseId: "project-danube",
        principalType: "HUMAN",
        correlationId: "corr-review-stale"
      })
    ).rejects.toMatchObject({
      code: "POLICY_DENIED",
      message: "LEGAL_REVIEW_REQUIRED:finding-permit-transfer"
    });
  });

  it("rejects a stale review subject version before mutating local state or calling Phase 5", async () => {
    const repository = new InMemoryScenarioRepository(createReviewedScenario());
    const phase5Client = createPhase5ClientDouble();
    const service = new ReviewService({ repository, phase5Client });
    const baseline = await repository.load();

    await expect(
      service.submitReview({
        caseId: "project-danube",
        findingId: "finding-permit-transfer",
        reviewType: "LEGAL",
        decision: "APPROVED",
        rationale: "Permit transfer completion steps are documented.",
        subjectVersion: "finding-permit-transfer-v1",
        principalType: "HUMAN",
        correlationId: "corr-review-stale-version"
      })
    ).rejects.toMatchObject({ code: "STATE_CONFLICT", message: "FINDING_VERSION_STALE" });

    expect(phase5Client.submitReview).not.toHaveBeenCalled();
    expect(await repository.load()).toEqual(baseline);
  });

  it("returns the existing specialist review success on an identical retry without duplicating history", async () => {
    const repository = new InMemoryScenarioRepository(createReviewedScenario());
    const phase5Client = createPhase5ClientDouble();
    const service = new ReviewService({
      repository,
      phase5Client,
      createId: () => "review-legal-1",
      now: () => "2026-08-06T10:20:00.000Z"
    });

    const firstState = await service.submitReview({
      caseId: "project-danube",
      findingId: "finding-permit-transfer",
      reviewType: "LEGAL",
      decision: "APPROVED",
      rationale: "Permit transfer completion steps are documented.",
      subjectVersion: "finding-permit-transfer-v2",
      principalType: "HUMAN",
      correlationId: "corr-review-1"
    });
    const secondState = await service.submitReview({
      caseId: "project-danube",
      findingId: "finding-permit-transfer",
      reviewType: "LEGAL",
      decision: "APPROVED",
      rationale: "Permit transfer completion steps are documented.",
      subjectVersion: "finding-permit-transfer-v2",
      principalType: "HUMAN",
      correlationId: "corr-review-2"
    });

    expect(secondState).toEqual(firstState);
    expect(phase5Client.submitReview).toHaveBeenCalledTimes(1);
    expect(secondState.reviews.filter((review) => review.reviewType === "LEGAL")).toHaveLength(1);
    expect(
      secondState.governanceEvents.filter((event) => event.type === "SPECIALIST_REVIEW_RECORDED")
    ).toHaveLength(1);
  });

  it("conflicts when a retry reuses the same review operation with a different payload", async () => {
    const repository = new InMemoryScenarioRepository(createReviewedScenario());
    const phase5Client = createPhase5ClientDouble();
    const service = new ReviewService({ repository, phase5Client });

    await service.submitReview({
      caseId: "project-danube",
      findingId: "finding-permit-transfer",
      reviewType: "LEGAL",
      decision: "APPROVED",
      rationale: "Permit transfer completion steps are documented.",
      subjectVersion: "finding-permit-transfer-v2",
      principalType: "HUMAN",
      correlationId: "corr-review-1"
    });

    await expect(
      service.submitReview({
        caseId: "project-danube",
        findingId: "finding-permit-transfer",
        reviewType: "LEGAL",
        decision: "APPROVED",
        rationale: "Updated wording should conflict with the original retry payload.",
        subjectVersion: "finding-permit-transfer-v2",
        principalType: "HUMAN",
        correlationId: "corr-review-2"
      })
    ).rejects.toMatchObject({ code: "STATE_CONFLICT", message: "REVIEW_RETRY_CONFLICT" });

    expect(phase5Client.submitReview).toHaveBeenCalledTimes(1);
    expect((await repository.load()).state.reviews).toHaveLength(1);
  });

  it("returns the existing committee-pack success on an identical retry without duplicating audit history", async () => {
    const repository = new InMemoryScenarioRepository(
      withCurrentSecurityGatePasses(
        createReviewedScenario([
          approvedReview("DEAL", "finding-ebitda-quality"),
          approvedReview("LEGAL", "finding-permit-transfer"),
          approvedReview("COMPLIANCE", "finding-permit-transfer")
        ])
      )
    );
    const phase5Client = createPhase5ClientDouble();
    const service = new ReviewService({
      repository,
      phase5Client,
      createId: () => "event-committee-pack",
      now: () => "2026-08-06T10:30:00.000Z"
    });

    const firstState = await service.prepareRecommendation({
      caseId: "project-danube",
      principalType: "HUMAN",
      correlationId: "corr-committee-pack-1"
    });
    const secondState = await service.prepareRecommendation({
      caseId: "project-danube",
      principalType: "HUMAN",
      correlationId: "corr-committee-pack-2"
    });

    expect(secondState).toEqual(firstState);
    expect(phase5Client.prepareDraft).toHaveBeenCalledTimes(1);
    expect(
      secondState.governanceEvents.filter((event) => event.type === "COMMITTEE_PACK_DRAFT_PREPARED")
    ).toHaveLength(1);
  });

  it("preserves both approvals and audit events when specialist reviews arrive concurrently", async () => {
    const repository = new InMemoryScenarioRepository(createReviewedScenario());
    const phase5Client = createPhase5ClientDouble();
    phase5Client.submitReview.mockImplementation(
      async () =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, 10);
        })
    );

    const service = new ReviewService({
      repository,
      phase5Client
    });

    await Promise.all([
      service.submitReview({
        caseId: "project-danube",
        findingId: "finding-ebitda-quality",
        reviewType: "DEAL",
        decision: "APPROVED",
        rationale: "Deal review confirms the accepted claim set is ready.",
        subjectVersion: "finding-ebitda-quality-v2",
        principalType: "HUMAN",
        correlationId: "corr-deal"
      }),
      service.submitReview({
        caseId: "project-danube",
        findingId: "finding-permit-transfer",
        reviewType: "LEGAL",
        decision: "APPROVED",
        rationale: "Legal review confirms the accepted claim set is ready.",
        subjectVersion: "finding-permit-transfer-v2",
        principalType: "HUMAN",
        correlationId: "corr-legal"
      })
    ]);

    const nextState = (await repository.load()).state;
    expect(nextState.reviews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reviewType: "DEAL", decision: "APPROVED" }),
        expect.objectContaining({ reviewType: "LEGAL", decision: "APPROVED" })
      ])
    );
    expect(nextState.reviews).toHaveLength(2);
    expect(
      nextState.governanceEvents.filter((event) => event.type === "SPECIALIST_REVIEW_RECORDED")
    ).toHaveLength(2);
  });
});
