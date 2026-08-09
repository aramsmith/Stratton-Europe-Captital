import type { ScenarioState } from "@stratton/contracts";
import { createProjectDanubeState } from "@stratton/scenario-data";
import { describe, expect, it } from "vitest";
import type { Phase5Client } from "../phase5/phase5-client.js";
import { InMemoryScenarioRepository } from "../scenario/in-memory-scenario-repository.js";
import { AnalysisService } from "../analysis/analysis-service.js";
import {
  buildRecommendationSubjectVersion,
  GovernanceService
} from "./governance-service.js";

function createGovernanceReadyState(): ScenarioState {
  const state = createProjectDanubeState();
  state.stage = "COMMITTEE_PREPARATION";
  state.evidence = state.evidence.map((evidence) => ({
    ...evidence,
    admissionStatus: "ADMITTED",
    provenanceStatus: "VERIFIED"
  }));
  state.latestAnalysisRun = {
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
  state.findings = [
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
          citationId: "citation-erp-812-886",
          evidenceId: "evidence-erp-rebates",
          locator: "rows 812-886",
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
  state.reviews = [
    {
      reviewId: "review-deal-approved",
      reviewType: "DEAL",
      decision: "APPROVED",
      findingId: "finding-ebitda-quality",
      subjectVersion: "finding-ebitda-quality-v2",
      projectionVersion: "finding-ebitda-quality-v2"
    },
    {
      reviewId: "review-compliance-approved",
      reviewType: "COMPLIANCE",
      decision: "APPROVED",
      findingId: "finding-permit-transfer",
      subjectVersion: "finding-permit-transfer-v2",
      projectionVersion: "finding-permit-transfer-v2"
    },
    {
      reviewId: "review-legal-approved",
      reviewType: "LEGAL",
      decision: "APPROVED",
      findingId: "finding-permit-transfer",
      subjectVersion: "finding-permit-transfer-v2",
      projectionVersion: "finding-permit-transfer-v2"
    }
  ];
  const recommendationSubjectVersion = buildRecommendationSubjectVersion(state);
  state.governanceEvents.push(
    {
      eventId: "event-route-selected",
      type: "MODEL_ROUTE_SELECTED",
      outcome: "ALLOW",
      occurredAtIso: "2026-08-06T10:05:00.000Z",
      correlationId: "corr-analysis-1",
      detail: "TERRA",
      metadata: {
        analysisRequestFingerprint:
          "9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
        questionHash: "95d4ab5821abf3ec7fa4b35f667fa5e3b71db280c5f7ab455ecb6c10f379b4e4",
        evidenceSetHash: "7a0cbdb7f6cff1ce34618a74be93fd6928840fa2712f822e7ef76a08b85c4f99",
        taskClass: "CROSS_DOCUMENT_COMPARISON",
        route: "TERRA",
        phase5RunId: "run-terra-1",
        authorityGateRole: "HUMAN_ANALYST_REVIEW_GATE",
        findingIds: [
          "finding-ebitda-quality",
          "finding-customer-concentration",
          "finding-permit-transfer"
        ]
      }
    },
    {
      eventId: "event-policy-check",
      type: "ANALYSIS_POLICY_CHECK",
      outcome: "ALLOW",
      occurredAtIso: "2026-08-06T10:05:01.000Z",
      correlationId: "corr-analysis-1",
      detail: "admitted-citations-only",
      metadata: {
        analysisRequestFingerprint:
          "9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
        questionHash: "95d4ab5821abf3ec7fa4b35f667fa5e3b71db280c5f7ab455ecb6c10f379b4e4",
        evidenceSetHash: "7a0cbdb7f6cff1ce34618a74be93fd6928840fa2712f822e7ef76a08b85c4f99",
        taskClass: "CROSS_DOCUMENT_COMPARISON",
        route: "TERRA",
        phase5RunId: "run-terra-1",
        authorityGateRole: "HUMAN_ANALYST_REVIEW_GATE",
        findingIds: [
          "finding-ebitda-quality",
          "finding-customer-concentration",
          "finding-permit-transfer"
        ]
      }
    },
    {
      eventId: "event-analysis-governed",
      type: "ANALYSIS_REQUEST_GOVERNED",
      outcome: "SUCCESS",
      occurredAtIso: "2026-08-06T10:05:02.000Z",
      correlationId: "corr-analysis-1",
      detail: "CROSS_DOCUMENT_COMPARISON:run-terra-1",
      metadata: {
        analysisRequestFingerprint:
          "9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
        questionHash: "95d4ab5821abf3ec7fa4b35f667fa5e3b71db280c5f7ab455ecb6c10f379b4e4",
        evidenceSetHash: "7a0cbdb7f6cff1ce34618a74be93fd6928840fa2712f822e7ef76a08b85c4f99",
        taskClass: "CROSS_DOCUMENT_COMPARISON",
        route: "TERRA",
        phase5RunId: "run-terra-1",
        authorityGateRole: "HUMAN_ANALYST_REVIEW_GATE",
        findingIds: [
          "finding-ebitda-quality",
          "finding-customer-concentration",
          "finding-permit-transfer"
        ]
      }
    },
    {
      eventId: "review-deal",
      type: "SPECIALIST_REVIEW_RECORDED",
      outcome: "SUCCESS",
      occurredAtIso: "2026-08-06T10:20:00.000Z",
      correlationId: "corr-review-deal",
      detail: "DEAL:APPROVED:finding-ebitda-quality",
      metadata: {
        analysisRequestFingerprint:
          "9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
        phase5RunId: "run-terra-1",
        findingIds: ["finding-ebitda-quality"],
        operationId: "review:DEAL:finding-ebitda-quality:finding-ebitda-quality-v2",
        payloadHash: "78dd91f93e4f745f725556085c8477c0a46fae2c7f136c8f47642c10f7e34d01",
        subjectVersion: "finding-ebitda-quality-v2"
      }
    },
    {
      eventId: "review-compliance",
      type: "SPECIALIST_REVIEW_RECORDED",
      outcome: "SUCCESS",
      occurredAtIso: "2026-08-06T10:21:00.000Z",
      correlationId: "corr-review-compliance",
      detail: "COMPLIANCE:APPROVED:finding-permit-transfer",
      metadata: {
        analysisRequestFingerprint:
          "9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
        phase5RunId: "run-terra-1",
        findingIds: ["finding-permit-transfer"],
        operationId:
          "review:COMPLIANCE:finding-permit-transfer:finding-permit-transfer-v2",
        payloadHash: "94bdfbbeb922da545c1338c4fe1fc2b1153684f13147dd0f4c91f4fb1e27dcaa",
        subjectVersion: "finding-permit-transfer-v2"
      }
    },
    {
      eventId: "review-legal",
      type: "SPECIALIST_REVIEW_RECORDED",
      outcome: "SUCCESS",
      occurredAtIso: "2026-08-06T10:22:00.000Z",
      correlationId: "corr-review-legal",
      detail: "LEGAL:APPROVED:finding-permit-transfer",
      metadata: {
        analysisRequestFingerprint:
          "9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
        phase5RunId: "run-terra-1",
        findingIds: ["finding-permit-transfer"],
        operationId: "review:LEGAL:finding-permit-transfer:finding-permit-transfer-v2",
        payloadHash: "d391e86d1b7530cd9254d66b41e9ac37f416138238179c7a28c4e4c57441a7ef",
        subjectVersion: "finding-permit-transfer-v2"
      }
    },
    {
      eventId: "event-committee-pack",
      type: "COMMITTEE_PACK_DRAFT_PREPARED",
      outcome: "SUCCESS",
      occurredAtIso: "2026-08-06T10:25:00.000Z",
      correlationId: "corr-committee-pack",
      detail: "run-terra-1",
      metadata: {
        phase5RunId: "run-terra-1",
        analysisRequestFingerprint:
          "9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
        findingIds: [
          "finding-ebitda-quality",
          "finding-customer-concentration",
          "finding-permit-transfer"
        ],
        operationId:
          `draft:run-terra-1:${recommendationSubjectVersion}`,
        payloadHash: "c6f8dba0a805bd7c05cb1f25ee0dfdc87ef2fa6b2b9e90b043c28052dc0ef45d",
        subjectVersion: recommendationSubjectVersion
      }
    }
  );

  state.governanceEvents.push(
    ...(() => {
      const analysisRequestFingerprint =
        state.latestAnalysisRun?.analysisRequestFingerprint;
      if (!analysisRequestFingerprint) {
        throw new Error("analysis fingerprint required");
      }
      return Array.from({ length: 12 }, (_, index) => {
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
            analysisRequestFingerprint
          }
        };
      });
    })()
  );

  return state;
}

function createAdmittedState(): ScenarioState {
  const state = createProjectDanubeState();
  state.evidence = state.evidence.map((evidence) => ({
    ...evidence,
    admissionStatus: "ADMITTED",
    provenanceStatus: "VERIFIED"
  }));
  return state;
}

function createPhase5ClientDouble(): Phase5Client {
  return {
    requestAnalysis: async () => ({
      analysisRunId: "run-terra-1",
      status: "QUEUED"
    }),
    admitEvidence: async () => undefined,
    submitReview: async () => undefined,
    prepareDraft: async () => undefined
  };
}

describe("GovernanceService", () => {
  it("records dedicated version-bound PASS evidence for all twelve mandatory gates", async () => {
    const initialState = createGovernanceReadyState();
    initialState.governanceEvents = initialState.governanceEvents.filter(
      (event) => event.type !== "SECURITY_GATE_EVIDENCE_RECORDED"
    );
    const repository = new InMemoryScenarioRepository(initialState);
    let id = 0;
    const service = new GovernanceService({
      repository,
      createId: () => `gate-event-${++id}`,
      now: () => "2026-08-06T12:00:00.000Z"
    });

    const state = await service.recordSecurityGateEvidence({
      caseId: "project-danube",
      correlationId: "corr-gate-suite"
    });
    const gateEvents = state.governanceEvents.filter(
      (event) => event.type === "SECURITY_GATE_EVIDENCE_RECORDED"
    );

    expect(gateEvents).toHaveLength(12);
    expect(gateEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outcome: "SUCCESS",
          metadata: expect.objectContaining({
            securityGateId: "CC002-R2-SEC-GATE-001",
            securityGateEvidenceId: "STRATTON-DEMO-SEC-GATE-001-v1",
            analysisRequestFingerprint:
              state.latestAnalysisRun?.analysisRequestFingerprint
          })
        })
      ])
    );
    expect(
      (await service.getView("project-danube")).securityGates.every(
        (gate) => gate.outcome === "PASS"
      )
    ).toBe(true);
  });

  it("links each material finding to evidence, route, review, policy events, and the recommendation preview", async () => {
    const service = new GovernanceService({
      repository: new InMemoryScenarioRepository(createGovernanceReadyState())
    });

    const view = await service.getView("project-danube");
    const ebitda = view.lineage.find((node) => node.id === "finding-ebitda-quality");

    expect(ebitda?.evidenceIds).toEqual([
      "evidence-board-pack",
      "evidence-erp-rebates",
      "evidence-qoe-report"
    ]);
    expect(ebitda?.modelRoute).toBe("TERRA");
    expect(ebitda?.reviewTypes).toEqual(["DEAL"]);
    expect(ebitda?.policyDecisionIds).toEqual(
      expect.arrayContaining(["event-policy-check", "event-analysis-governed", "review-deal"])
    );
    expect(ebitda?.recommendationIds).toEqual(["event-committee-pack"]);
    expect(view.policyDecisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          decisionId: "review-deal",
          policyType: "SPECIALIST_REVIEW_RECORDED",
          result: "SUCCESS",
          version: "finding-ebitda-quality-v2",
          correlationId: "corr-review-deal"
        })
      ])
    );
    expect(view.modelRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          routeId: "run-terra-1",
          taskClass: "CROSS_DOCUMENT_COMPARISON",
          modelRoute: "TERRA",
          primaryEvidenceIds: [
            "evidence-board-pack",
            "evidence-environmental-permit",
            "evidence-erp-rebates",
            "evidence-qoe-report"
          ]
        })
      ])
    );
    expect(view.securityGates.map((gate) => gate.gateId)).toEqual([
      "CC002-R2-SEC-GATE-001",
      "CC002-R2-SEC-GATE-002",
      "CC002-R2-SEC-GATE-003",
      "CC002-R2-SEC-GATE-004",
      "CC002-R2-SEC-GATE-005",
      "CC002-R2-SEC-GATE-006",
      "CC002-R2-SEC-GATE-007",
      "CC002-R2-SEC-GATE-008",
      "CC002-R2-SEC-GATE-009",
      "CC002-R2-SEC-GATE-010",
      "CC002-R2-SEC-GATE-011",
      "CC002-R2-SEC-GATE-012"
    ]);
    expect(
      view.securityGates.find((gate) => gate.gateId === "CC002-R2-SEC-GATE-004")
    ).toMatchObject({ outcome: "PASS" });
    expect(
      view.securityGates.find((gate) => gate.gateId === "CC002-R2-SEC-GATE-008")
    ).toMatchObject({ outcome: "PASS" });
    expect(
      view.securityGates.find((gate) => gate.gateId === "CC002-R2-SEC-GATE-012")
    ).toMatchObject({ outcome: "PASS" });
    expect(
      view.securityGates.find((gate) => gate.gateId === "CC002-R2-SEC-GATE-001")
    ).toMatchObject({ outcome: "PASS" });
    expect(view.auditExport).toEqual({
      status: "READY",
      missingItems: [],
      previewSections: ["Lineage", "Policy decisions", "Model routes", "Security & audit"]
    });
  });

  it("binds route and policy events emitted by AnalysisService to the latest analysis route", async () => {
    let sequence = 0;
    const repository = new InMemoryScenarioRepository(createAdmittedState());
    const analysisService = new AnalysisService({
      repository,
      compatibilityMode: "LEGACY_TEST_ONLY",
      phase5Client: createPhase5ClientDouble(),
      createId: () => `generated-${++sequence}`,
      now: () => "2026-08-06T10:05:00.000Z"
    });

    await analysisService.run({
      caseId: "project-danube",
      taskClass: "CROSS_DOCUMENT_COMPARISON",
      question: "Challenge management EBITDA quality",
      correlationId: "corr-analysis-1"
    });

    const view = await new GovernanceService({ repository }).getView("project-danube");

    expect(view.modelRoutes).toEqual([
      expect.objectContaining({
        routeId: "run-terra-1",
        routeEventIds: [
          "generated-4",
          "generated-5",
          "generated-7"
        ]
      })
    ]);
  });

  it("keeps review lineage version-bound when a finding has moved past an earlier approval", async () => {
    const state = createGovernanceReadyState();
    state.findings = state.findings.map((finding) =>
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
                occurredAtIso: "2026-08-06T10:30:00.000Z"
              }
            ]
          }
        : finding
    );

    const service = new GovernanceService({
      repository: new InMemoryScenarioRepository(state)
    });

    const view = await service.getView("project-danube");
    const permit = view.lineage.find((node) => node.id === "finding-permit-transfer");

    expect(permit?.reviewTypes).toEqual([]);
    expect(permit?.policyDecisionIds).toEqual([
      "event-analysis-governed",
      "event-policy-check",
      "event-route-selected"
    ]);
    expect(
      (permit as
        | {
            assuranceStatus?: string;
            historicalPolicyDecisionIds?: readonly string[];
            historicalReviewTypes?: readonly string[];
            historicalReviewVersionIds?: readonly string[];
            historicalRecommendationIds?: readonly string[];
          }
        | undefined)?.assuranceStatus
    ).toBe("STALE");
    expect(
      (permit as
        | {
            historicalPolicyDecisionIds?: readonly string[];
          }
        | undefined)?.historicalPolicyDecisionIds
    ).toEqual(["review-compliance", "review-legal"]);
    expect(
      (permit as
        | {
            historicalReviewTypes?: readonly string[];
            historicalReviewVersionIds?: readonly string[];
          }
        | undefined)?.historicalReviewTypes
    ).toEqual(["COMPLIANCE", "LEGAL"]);
    expect(
      (permit as
        | {
            historicalReviewVersionIds?: readonly string[];
          }
        | undefined)?.historicalReviewVersionIds
    ).toEqual(["finding-permit-transfer-v2"]);
    expect(
      (permit as
        | {
            historicalRecommendationIds?: readonly string[];
          }
        | undefined)?.historicalRecommendationIds
    ).toEqual(["event-committee-pack"]);
    expect(permit?.recommendationIds).toEqual([]);
  });

  it("derives gate outcomes only from dedicated gate-specific evidence events", async () => {
    const state = createGovernanceReadyState();
    state.governanceEvents = state.governanceEvents.filter(
      (event) => event.type !== "SECURITY_GATE_EVIDENCE_RECORDED"
    );
    const analysisRequestFingerprint =
      state.latestAnalysisRun?.analysisRequestFingerprint;
    if (!analysisRequestFingerprint) {
      throw new Error("analysis fingerprint required");
    }
    state.governanceEvents.push(
      {
        eventId: "gate-004-pass",
        type: "SECURITY_GATE_EVIDENCE_RECORDED",
        outcome: "SUCCESS",
        occurredAtIso: "2026-08-06T10:26:00.000Z",
        correlationId: "corr-gate-004",
        detail: "Citation spoofing scenario replay",
        metadata: {
          securityGateId: "CC002-R2-SEC-GATE-004",
          securityGateEvidenceId: "STRATTON-DEMO-SEC-GATE-004-v1",
          analysisRequestFingerprint
        }
      },
      {
        eventId: "gate-008-fail",
        type: "SECURITY_GATE_EVIDENCE_RECORDED",
        outcome: "FAILURE",
        occurredAtIso: "2026-08-06T10:27:00.000Z",
        correlationId: "corr-gate-008",
        detail: "Revoked evidence scenario replay",
        metadata: {
          securityGateId: "CC002-R2-SEC-GATE-008",
          securityGateEvidenceId: "evidence-expired-licence",
          analysisRequestFingerprint
        }
      }
    );

    const view = await new GovernanceService({
      repository: new InMemoryScenarioRepository(state)
    }).getView("project-danube");

    expect(
      view.securityGates.find((gate) => gate.gateId === "CC002-R2-SEC-GATE-004")
    ).toMatchObject({
      outcome: "PASS",
      evidenceId: "STRATTON-DEMO-SEC-GATE-004-v1"
    });
    expect(
      view.securityGates.find((gate) => gate.gateId === "CC002-R2-SEC-GATE-008")
    ).toMatchObject({ outcome: "FAIL", evidenceId: "evidence-expired-licence" });
    expect(
      view.securityGates.find((gate) => gate.gateId === "CC002-R2-SEC-GATE-012")
    ).toMatchObject({ outcome: "NOT_RUN" });
    expect(
      view.securityGates.filter((gate) => gate.outcome === "NOT_RUN").map((gate) => gate.gateId)
    ).toEqual(
      expect.arrayContaining([
        "CC002-R2-SEC-GATE-001",
        "CC002-R2-SEC-GATE-002",
        "CC002-R2-SEC-GATE-003",
        "CC002-R2-SEC-GATE-005",
        "CC002-R2-SEC-GATE-006",
        "CC002-R2-SEC-GATE-007",
        "CC002-R2-SEC-GATE-009",
        "CC002-R2-SEC-GATE-010",
        "CC002-R2-SEC-GATE-011",
        "CC002-R2-SEC-GATE-012"
      ])
    );
  });

  it("fails closed when Project Danube has not produced governed route evidence yet", async () => {
    const service = new GovernanceService({
      repository: new InMemoryScenarioRepository(createProjectDanubeState())
    });

    const view = await service.getView("project-danube");

    expect(view.lineage).toEqual([]);
    expect(view.policyDecisions).toEqual([]);
    expect(view.modelRoutes).toEqual([]);
    expect(view.securityGates.every((gate) => gate.outcome === "NOT_RUN")).toBe(true);
    expect(view.auditExport).toEqual({
      status: "BLOCKED",
      missingItems: [
        "Governed analysis route evidence has not been recorded.",
        "Committee-pack draft evidence has not been prepared.",
        "Mandatory security gates are not ready: SECURITY_GATE_CC002-R2-SEC-GATE-001_NOT_RUN."
      ],
      previewSections: ["Lineage", "Policy decisions", "Model routes", "Security & audit"]
    });
  });
});
